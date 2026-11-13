import { Elysia, t } from 'elysia';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from './db';
import { describeHash, verifyPassword } from './lib/password';
import {
  SESSION_COOKIE, SESSION_TTL_MS, clearFailedLogins, clientIp, createSession, destroySession,
  detectImageType, hashIp, isValidSession, loginBlockedSeconds, rateLimited, recordFailedLogin,
} from './lib/security';

const CATEGORIES: Record<string, string> = {
  florist: 'Florist',
  gift: 'Gift & Hampers',
  craft: 'Craft & Preserved',
  coffee: 'Cafe & Treats',
};

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // batas body Vercel Functions ~4.5 MB
const UPLOAD_DIR = join(process.cwd(), '.uploads'); // hanya untuk pengembangan lokal
// Vercel Blob bisa memakai token (BLOB_READ_WRITE_TOKEN) atau OIDC (BLOB_STORE_ID)
const blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const isProd = () => process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const IMAGE_PATTERNS = [
  /^\/assets\/[\w.-]+$/,
  /^\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/,
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/products\/[\w.-]+$/,
];
const isAllowedImage = (s: string) => IMAGE_PATTERNS.some((re) => re.test(s));

const text = (min: number, max: number) => t.String({ minLength: min, maxLength: max });

const productBody = t.Object({
  name: text(1, 120),
  category: t.Union(Object.keys(CATEGORIES).map((k) => t.Literal(k))),
  price: t.Integer({ minimum: 0, maximum: 100_000_000 }),
  badge: text(0, 40),
  description: text(1, 1000),
  image: text(1, 500),
});

function getCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Perlindungan CSRF untuk request admin yang mengubah data. */
function csrfOk(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  if (request.headers.get('x-requested-with') !== 'dyflorist') return false;
  const origin = request.headers.get('origin');
  return !!origin && allowedOrigins().includes(origin);
}

function sessionCookie(value: string, expires: Date | null): string {
  const attrs = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (isProd()) attrs.push('Secure');
  if (expires) {
    attrs.push(`Expires=${expires.toUTCString()}`, `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
  } else {
    attrs.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'Max-Age=0');
  }
  return attrs.join('; ');
}

async function storeImage(buf: Uint8Array, ext: string, contentType: string): Promise<string> {
  const name = randomBytes(16).toString('hex');
  if (blobConfigured()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`products/${name}.${ext}`, Buffer.from(buf), {
      access: 'public', contentType, addRandomSuffix: false,
    });
    return blob.url;
  }
  if (isProd()) throw new Error('Penyimpanan foto belum dikonfigurasi');
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, `${name}.${ext}`), buf);
  return `/api/uploads/${name}.${ext}`;
}

async function removeImage(url: string) {
  if (!url.includes('.public.blob.vercel-storage.com/') || !blobConfigured()) return;
  try {
    const { del } = await import('@vercel/blob');
    await del(url);
  } catch {
    /* penghapusan foto lama bersifat best-effort */
  }
}

const toPublic = (p: typeof schema.products.$inferSelect) => ({
  id: p.id, name: p.name, category: p.category, categoryName: p.categoryName, price: p.price,
  badge: p.badge, description: p.description, image: p.image, rating: p.rating / 10, reviews: p.reviews,
});

const denied = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });

export const app = new Elysia({ prefix: '/api' })
  // Pengecekan CSRF + login dijalankan paling awal, sebelum parsing/validasi body
  .onRequest(async ({ request }) => {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/api/admin')) return;
    if (!csrfOk(request)) return denied(403, 'Permintaan ditolak');
    if (path === '/api/admin/login') return;
    if (!(await isValidSession(getCookie(request, SESSION_COOKIE)))) return denied(401, 'Belum login');
  })
  .onAfterHandle({ as: 'global' }, ({ set }) => {
    set.headers['x-content-type-options'] = 'nosniff';
    set.headers['x-frame-options'] = 'DENY';
    set.headers['referrer-policy'] = 'no-referrer';
    set.headers['cache-control'] ??= 'no-store';
  })
  .onError({ as: 'global' }, ({ code, set, error }) => {
    set.headers['x-content-type-options'] = 'nosniff';
    set.headers['cache-control'] = 'no-store';
    if (code === 'VALIDATION' || code === 'PARSE') {
      set.status = 422;
      return { error: 'Data tidak valid' };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: 'Tidak ditemukan' };
    }
    console.error('API error:', error instanceof Error ? error.message : error);
    set.status = 500;
    return { error: 'Terjadi kesalahan server' };
  })

  // ---------- Publik ----------
  .get('/health', () => ({ ok: true }))

  .get('/products', async () => {
    // Tanpa cache: perubahan dari admin harus langsung terlihat
    const rows = await getDb().select().from(schema.products)
      .orderBy(desc(schema.products.createdAt), desc(schema.products.id));
    return rows.map(toPublic);
  })

  .get('/uploads/:name', async ({ params, set }) => {
    // Hanya untuk pengembangan lokal; di produksi foto ada di Vercel Blob
    if (isProd() || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(params.name)) {
      set.status = 404;
      return { error: 'Tidak ditemukan' };
    }
    try {
      const data = await readFile(join(UPLOAD_DIR, params.name));
      const ext = params.name.split('.')[1];
      set.headers['content-type'] = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      set.headers['cache-control'] = 'public, max-age=31536000, immutable';
      return new Response(data, { headers: set.headers as Record<string, string> });
    } catch {
      set.status = 404;
      return { error: 'Tidak ditemukan' };
    }
  })

  .post('/orders', async ({ body, request, set }) => {
    const ipHash = hashIp(clientIp(request));
    if (await rateLimited('order', ipHash, 5, 10 * 60 * 1000)) {
      set.status = 429;
      set.headers['retry-after'] = '600';
      return { error: 'Terlalu banyak pesanan. Coba lagi nanti.' };
    }
    const db = getDb();
    const ids = [...new Set(body.items.map((i) => i.id))];
    const found = await db.select().from(schema.products).where(inArray(schema.products.id, ids));
    if (found.length !== ids.length) {
      set.status = 400;
      return { error: 'Ada produk yang tidak tersedia' };
    }
    const byId = new Map(found.map((p) => [p.id, p]));
    const lines = body.items.map((i) => {
      const p = byId.get(i.id)!;
      return { productId: p.id, name: p.name, price: p.price, qty: i.qty };
    });
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0); // dihitung ulang di server
    const orderId = await db.transaction(async (tx) => {
      const [res] = await tx.insert(schema.orders).values({
        recipient: body.recipient, scheduled: body.scheduled, note: body.note, total,
      });
      const id = Number(res.insertId);
      await tx.insert(schema.orderItems).values(lines.map((l) => ({ ...l, orderId: id })));
      return id;
    });
    return { id: orderId, total };
  }, {
    body: t.Object({
      recipient: text(1, 120),
      scheduled: text(1, 120),
      note: text(0, 500),
      items: t.Array(t.Object({ id: text(1, 40), qty: t.Integer({ minimum: 1, maximum: 50 }) }),
        { minItems: 1, maxItems: 30 }),
    }),
  })

  // ---------- Login admin ----------
  .post('/admin/login', async ({ body, request, set }) => {
    const ipHash = hashIp(clientIp(request));
    const blocked = await loginBlockedSeconds(ipHash);
    if (blocked > 0) {
      set.status = 429;
      set.headers['retry-after'] = String(blocked);
      return { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(blocked / 60)} menit.` };
    }
    const stored = process.env.ADMIN_PASSWORD_HASH ?? '';
    const ok = stored ? await verifyPassword(body.password, stored) : false;
    if (!ok) {
      if (describeHash(stored) !== 'format benar') {
        console.error('Login admin gagal: ADMIN_PASSWORD_HASH ' + describeHash(stored));
      }
      await recordFailedLogin(ipHash);
      set.status = 401;
      return { error: 'Password salah' };
    }
    await clearFailedLogins(ipHash);
    const { token, expires } = await createSession();
    set.headers['set-cookie'] = sessionCookie(token, expires);
    return { ok: true };
  }, { body: t.Object({ password: text(1, 200) }) })

  // ---------- Area admin (wajib login + CSRF) ----------
  .group('/admin', (admin) => admin
    .get('/session', () => ({ ok: true }))

    .post('/logout', async ({ request, set }) => {
      await destroySession(getCookie(request, SESSION_COOKIE));
      set.headers['set-cookie'] = sessionCookie('', null);
      return { ok: true };
    })

    .post('/products', async ({ body, set }) => {
      if (!isAllowedImage(body.image)) {
        set.status = 422;
        return { error: 'Foto tidak valid' };
      }
      const id = 'prod_' + randomUUID().replace(/-/g, '').slice(0, 16);
      await getDb().insert(schema.products).values({
        id, ...body, categoryName: CATEGORIES[body.category], rating: 50, reviews: 1,
        badge: body.badge || 'New Arrival',
      });
      return { id };
    }, { body: productBody })

    .put('/products/:id', async ({ params, body, set }) => {
      if (!isAllowedImage(body.image)) {
        set.status = 422;
        return { error: 'Foto tidak valid' };
      }
      const db = getDb();
      const [old] = await db.select().from(schema.products).where(eq(schema.products.id, params.id)).limit(1);
      if (!old) {
        set.status = 404;
        return { error: 'Produk tidak ditemukan' };
      }
      await db.update(schema.products)
        .set({ ...body, categoryName: CATEGORIES[body.category] })
        .where(eq(schema.products.id, params.id));
      if (old.image !== body.image) await removeImage(old.image);
      return { ok: true };
    }, { body: productBody })

    .delete('/products/:id', async ({ params, set }) => {
      const db = getDb();
      const [old] = await db.select().from(schema.products).where(eq(schema.products.id, params.id)).limit(1);
      if (!old) {
        set.status = 404;
        return { error: 'Produk tidak ditemukan' };
      }
      await db.delete(schema.products).where(eq(schema.products.id, params.id));
      await removeImage(old.image);
      return { ok: true };
    })

    .post('/upload', async ({ body, set }) => {
      const file = body.file;
      if (file.size > MAX_UPLOAD_BYTES) {
        set.status = 413;
        return { error: 'Foto terlalu besar (maks 4 MB)' };
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const type = detectImageType(buf);
      if (!type) {
        set.status = 415;
        return { error: 'Hanya JPG, PNG, atau WebP' };
      }
      const contentType = type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'image/jpeg';
      return { url: await storeImage(buf, type, contentType) };
    }, { body: t.Object({ file: t.File() }) })

    .get('/orders', async () => {
      const db = getDb();
      const orders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).limit(500);
      const items = orders.length
        ? await db.select().from(schema.orderItems).where(inArray(schema.orderItems.orderId, orders.map((o) => o.id)))
        : [];
      return orders.map((o) => ({
        id: o.id, recipient: o.recipient, scheduled: o.scheduled, note: o.note, total: o.total,
        createdAt: o.createdAt,
        items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      }));
    })

    .delete('/orders', async () => {
      const db = getDb();
      await db.delete(schema.orderItems);
      await db.delete(schema.orders);
      return { ok: true };
    }),
  );

export default app;
