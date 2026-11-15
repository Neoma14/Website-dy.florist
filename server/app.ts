import { SITE_URL, sendBlockedAlert } from './lib/mailer';
import { demoInvitation } from './invitations/demo';
import {
  ATTENDANCE, INVITATION_STATUSES, RETENTION_OPTIONS, intakeSummary, isValidSlug, mediaUrls, mergeIntake, newInvitationData, normalizeInvitationData,
  parseIntake, parseStoredData, pickIntake, publishProblems,
} from './invitations/model';
import {
  archiveIfExpired, attendanceStats, clearExpiredPreviews, expiresAtOf, findInvitationById, findInvitationByIntakeToken, findInvitationBySlug,
  invitationShareHtml, newToken, publicInvitation, publicWish, sweepExpired, tokenEquals, toDate,
} from './invitations/service';
import { Elysia, t } from 'elysia';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { describeHash, verifyPassword } from './lib/password';
import {
  SESSION_COOKIE, SESSION_TTL_MS, clearFailedLogins, clientIp, createSession, destroySession,
  detectImageType, hashIp, isMp3, loginGate, LOCK_MS, rateLimited, registerFailedLogin, createRecoveryToken, sessionRole, useRecoveryToken,
  type AdminRole,
} from './lib/security';

// Admin Undangan hanya boleh membuka menu undangan digital (plus cek sesi & keluar)
const UNDANGAN_ADMIN_PATHS = /^\/api\/admin\/(session|logout|invitations(\/.*)?)$/;


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
async function getCategoryName(key: string): Promise<string | null> {
  const [row] = await getDb().select({ name: schema.categories.name })
    .from(schema.categories).where(eq(schema.categories.key, key)).limit(1);
  return row?.name ?? null;
}

function slugify(name: string): string {
  const slug = name.toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return slug || 'kategori';
}

// Buang karakter kontrol & tanda kurung sudut dari teks kategori (defense in depth; tampilan tetap di-escape)
const cleanText = (v: string) => v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim();

const isAllowedImage = (s: string) => IMAGE_PATTERNS.some((re) => re.test(s));

// Harga coret hanya disimpan jika lebih tinggi dari harga jual (diskon nyata); selain itu dikosongkan
const normalizeOriginalPrice = (price: number, original?: number | null) =>
  original && original > price ? original : null;

const text = (min: number, max: number) => t.String({ minLength: min, maxLength: max });

const productBody = t.Object({
  name: text(1, 120),
  category: t.String({ minLength: 1, maxLength: 30, pattern: '^[a-z0-9_]+$' }),
  price: t.Integer({ minimum: 0, maximum: 100_000_000 }),
  originalPrice: t.Optional(t.Union([t.Integer({ minimum: 0, maximum: 100_000_000 }), t.Null()])),
  // Link contoh undangan digital (hanya halaman undangan di situs ini); kosong = tidak ada
  demoUrl: t.Optional(t.Union([t.String({ maxLength: 70, pattern: '^(/undangan/[a-z0-9-]{1,60})?$' }), t.Null()])),
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
  // Toleran terhadap spasi dan garis miring di akhir (mis. "https://www.dyflorist.site/")
  const list = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    // Buang semua karakter tak terlihat/non-ASCII (alamat situs hanya berisi ASCII tercetak)
    .map((s) => s.replace(/[^\x21-\x7e]/g, '').replace(/\/+$/, ''))
    .filter(Boolean);
  // Hanya di deploy Preview: izinkan alamat deploy itu sendiri (berganti tiap push).
  // Preview dilindungi Vercel Authentication; Production tetap hanya memakai ALLOWED_ORIGIN.
  if (process.env.VERCEL_ENV === 'preview') {
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
      if (host) list.push(`https://${host}`);
    }
  }
  return list;
}

/** Perlindungan CSRF untuk request admin yang mengubah data. */
function csrfOk(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  if (request.headers.get('x-requested-with') !== 'dyflorist') return false;
  const origin = request.headers.get('origin');
  const allowed = allowedOrigins();
  // Same-origin: Origin harus sama dengan alamat situs ini sendiri. Browser tidak bisa memalsukan
  // header Origin, jadi situs lain tidak bisa menyuruh browser admin melakukan aksi.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '')
    .split(',')[0]
    .replace(/[^\x21-\x7e]/g, '');
  const sameOrigin = !!origin && !!host && origin === `https://${host}`;
  const ok = !!origin && (sameOrigin || allowed.includes(origin));
  if (!ok) {
    // Alamat situs bukan rahasia; log ini membantu menemukan salah ketik di ALLOWED_ORIGIN
    console.error(
      `CSRF ditolak: origin="${origin ?? ''}" tidak ada di ALLOWED_ORIGIN ` +
      `(terdaftar: ${allowed.length}, panjang: [${allowed.map((a) => a.length).join(',')}], ` +
      `mentah: ${(process.env.ALLOWED_ORIGIN ?? '').length} karakter, env: ${process.env.VERCEL_ENV ?? 'lokal'})`,
    );
  }
  return ok;
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

async function storeImage(buf: Uint8Array, ext: string, contentType: string, folder: 'products' | 'invitations' = 'products'): Promise<string> {
  const name = randomBytes(16).toString('hex');
  if (blobConfigured()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`${folder}/${name}.${ext}`, Buffer.from(buf), {
      access: 'public', contentType, addRandomSuffix: false,
    });
    return blob.url;
  }
  if (isProd()) throw new Error('Penyimpanan foto belum dikonfigurasi');
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, `${name}.${ext}`), buf);
  return `/api/uploads/${name}.${ext}`;
}

// Berkas undangan hanya dihapus bila memang di folder invitations/ (isian pelanggan tidak boleh memicu hapus foto produk)
async function removeInvitationMedia(url: string) {
  if (url.includes('/invitations/')) await removeImage(url);
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
  originalPrice: p.originalPrice ?? null,
  demoUrl: p.demoUrl ?? null,
  badge: p.badge, description: p.description, image: p.image, rating: p.rating / 10, reviews: p.reviews,
});

const BLOCKED_MSG = 'Login dari perangkat ini diblokir karena password salah berulang kali. Link pemulihan sudah dikirim ke email dy.florist.';

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
    if (path === '/api/admin/login' || path === '/api/admin/recover') return;
    const role = await sessionRole(getCookie(request, SESSION_COOKIE));
    if (!role) return denied(401, 'Belum login');
    if (role === 'undangan' && !UNDANGAN_ADMIN_PATHS.test(path)) return denied(403, 'Akun Admin Undangan hanya bisa membuka menu undangan digital');
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

  .get('/categories', async () => {
    const rows = await getDb().select().from(schema.categories)
      .orderBy(asc(schema.categories.sort), asc(schema.categories.key));
    return rows.map((c) => ({ key: c.key, name: c.name, emoji: c.emoji }));
  })

  // Halaman kecil berisi tag Open Graph agar link produk di WhatsApp tampil dengan foto produk
  .get('/share/:id', async ({ params }) => {
    const html = (body: string, status = 200) => new Response(body, {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
    const id = params.id;
    const [p] = /^[\w-]{1,40}$/.test(id)
      ? await getDb().select().from(schema.products).where(eq(schema.products.id, id)).limit(1)
      : [];
    if (!p) {
      return html('<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/katalog"><title>dy.florist</title></head><body><a href="/katalog">Lihat katalog dy.florist</a></body></html>', 404);
    }
    const e = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const image = p.image.startsWith('/') ? SITE_URL + p.image : p.image;
    const price = 'Rp ' + p.price.toLocaleString('id-ID');
    const target = `/katalog?produk=${encodeURIComponent(p.id)}`;
    const title = `${p.name} — ${price}`;
    return html(`<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8">
<title>${e(title)} | dy.florist</title>
<meta name="description" content="${e(p.description.slice(0, 200))}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="dy.florist">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(p.description.slice(0, 200))}">
<meta property="og:image" content="${e(image)}">
<meta property="og:url" content="${e(SITE_URL + '/produk/' + p.id)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${e(SITE_URL + target)}">
<meta http-equiv="refresh" content="0; url=${e(target)}">
</head><body><p><a href="${e(target)}">${e(p.name)}</a></p></body></html>`);
  })

  // ---------- Undangan digital (publik) ----------
  // Undangan terbit bisa dibuka siapa saja; draft hanya oleh admin yang sedang login (pratinjau)
  .get('/invitations/:slug', async ({ params, query, request, set }) => {
    if (params.slug === 'demo') {
      set.headers['cache-control'] = 'public, max-age=60';
      return demoInvitation();
    }
    const row = /^[a-z0-9-]{3,60}$/.test(params.slug) ? await findInvitationBySlug(params.slug) : undefined;
    if (row && (row.status === 'arsip' || await archiveIfExpired(row))) {
      set.status = 410;
      return { error: 'Undangan ini sudah tidak aktif.' };
    }
    let preview = false;
    if (row?.status === 'draft') {
      // Pratinjau: admin yang login, atau pelanggan dengan link rahasia yang masih berlaku
      const token = typeof query.preview === 'string' ? query.preview : '';
      const tokenOk = tokenEquals(token, row.previewToken) && (toDate(row.previewExpiresAt)?.getTime() ?? 0) > Date.now();
      preview = tokenOk || !!(await sessionRole(getCookie(request, SESSION_COOKIE)));
      if (!preview && token) {
        set.status = 403;
        return { error: 'Link pratinjau sudah tidak berlaku. Minta link baru ke dy.florist.' };
      }
    }
    if (!row || (row.status !== 'terbit' && !preview)) {
      set.status = 404;
      return { error: 'Undangan tidak ditemukan' };
    }
    // Tanpa cache: ucapan baru harus langsung terlihat saat tamu memuat ulang halaman
    set.headers['cache-control'] = 'no-store';
    return publicInvitation(row, preview);
  })

  // Ucapan & konfirmasi kehadiran dari tamu
  .post('/invitations/:slug/wishes', async ({ params, body, request, set }) => {
    // Header khusus memaksa browser melakukan preflight, sehingga situs lain tidak bisa mengirim ucapan atas nama tamu
    if (request.headers.get('x-requested-with') !== 'dyflorist') {
      set.status = 403;
      return { error: 'Permintaan ditolak' };
    }
    const row = /^[a-z0-9-]{3,60}$/.test(params.slug) ? await findInvitationBySlug(params.slug) : undefined;
    if (row && await archiveIfExpired(row)) {
      set.status = 410;
      return { error: 'Undangan ini sudah tidak aktif.' };
    }
    if (!row || row.status !== 'terbit') {
      set.status = 404;
      return { error: 'Undangan tidak ditemukan' };
    }
    const d = parseStoredData(row.data);
    if (!d.wishes.enabled && !d.rsvp.enabled) {
      set.status = 403;
      return { error: 'Ucapan untuk undangan ini ditutup' };
    }
    const ipHash = hashIp(clientIp(request));
    if (await rateLimited(`wish:${row.id}`, ipHash, 5, 10 * 60 * 1000)) {
      set.status = 429;
      return { error: 'Terlalu banyak ucapan dalam waktu singkat. Coba lagi nanti.' };
    }
    if (await rateLimited(`wish-all:${row.id}`, 'all', 300, 60 * 60 * 1000)) {
      set.status = 429;
      return { error: 'Sedang banyak ucapan masuk. Coba lagi beberapa menit lagi.' };
    }
    const clean = (s: string, max: number) => s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
    const name = clean(body.name, 60).replace(/\n/g, ' ');
    const message = clean(body.message, 300);
    const attendance = d.rsvp.enabled && body.attendance ? body.attendance : null;
    if (!name || !message) {
      set.status = 422;
      return { error: 'Nama dan ucapan wajib diisi' };
    }
    if (d.rsvp.enabled && !attendance) {
      set.status = 422;
      return { error: 'Mohon pilih konfirmasi kehadiran' };
    }
    const guests = attendance === 'hadir' ? Math.min(d.rsvp.maxGuests, Math.max(1, body.guests ?? 1)) : 0;
    const status = d.wishes.requireApproval ? 'menunggu' : 'tampil';
    const [res] = await getDb().insert(schema.invitationWishes).values({
      invitationId: row.id, name, message, attendance, guests, status, ipHash,
    });
    return {
      ok: true,
      status,
      item: publicWish({ id: Number(res.insertId), invitationId: row.id, name, message, attendance, guests, status, ipHash, createdAt: new Date() }),
    };
  }, {
    body: t.Object({
      name: text(1, 60),
      message: text(1, 300),
      attendance: t.Optional(t.Union([...ATTENDANCE.map((a) => t.Literal(a)), t.Null()])),
      guests: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
    }),
  })

  // Pratinjau link undangan untuk WhatsApp/media sosial (dipanggil lewat rewrite khusus bot di vercel.json)
  .get('/invitation-share/:slug', async ({ params, query }) => {
    const guest = typeof query.to === 'string' ? query.to.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    const { status, html } = await invitationShareHtml(params.slug.toLowerCase(), guest);
    return new Response(html, {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' },
    });
  })

  // ---------- Formulir data untuk pelanggan (link rahasia dari admin) ----------
  // Pelanggan mengisi data pribadi & acara sendiri; hasilnya ditinjau admin sebelum diterapkan ke undangan
  .get('/intake/:token', async ({ params, request, set }) => {
    if (await rateLimited('intake-get', hashIp(clientIp(request)), 120, 10 * 60 * 1000)) {
      set.status = 429;
      return { error: 'Terlalu banyak permintaan. Coba lagi nanti.' };
    }
    const row = await findInvitationByIntakeToken(params.token);
    if (!row || row.intakeStatus === 'none') {
      set.status = 404;
      return { error: 'Formulir tidak ditemukan atau link sudah tidak berlaku.' };
    }
    const base = parseStoredData(row.data);
    const intake = parseIntake(row.intakeData);
    return {
      status: row.intakeStatus,
      editable: row.intakeStatus === 'open' || row.intakeStatus === 'submitted',
      data: pickIntake(intake ? mergeIntake(base, intake) : base),
    };
  })

  .put('/intake/:token', async ({ params, body, request, set }) => {
    if (request.headers.get('x-requested-with') !== 'dyflorist') {
      set.status = 403;
      return { error: 'Permintaan ditolak' };
    }
    if (await rateLimited('intake-put', hashIp(clientIp(request)), 40, 10 * 60 * 1000)) {
      set.status = 429;
      return { error: 'Terlalu banyak penyimpanan. Coba lagi beberapa menit lagi.' };
    }
    const row = await findInvitationByIntakeToken(params.token);
    if (!row || row.intakeStatus === 'none') {
      set.status = 404;
      return { error: 'Formulir tidak ditemukan atau link sudah tidak berlaku.' };
    }
    if (row.intakeStatus !== 'open' && row.intakeStatus !== 'submitted') {
      set.status = 409;
      return { error: 'Formulir sudah ditutup. Hubungi dy.florist bila ada yang ingin diubah.' };
    }
    const picked = pickIntake(normalizeInvitationData(body.data));
    const json = JSON.stringify(picked);
    if (json.length > 150_000) {
      set.status = 413;
      return { error: 'Isian terlalu panjang' };
    }
    const status = body.submit ? 'submitted' : row.intakeStatus;
    const before = mediaUrls(parseStoredData(row.intakeData ?? '{}'));
    await getDb().update(schema.invitations).set({
      intakeData: json, intakeStatus: status, updatedAt: new Date(),
      intakeSubmittedAt: body.submit ? new Date() : toDate(row.intakeSubmittedAt),
    }).where(eq(schema.invitations.id, row.id));
    // Foto yang diganti pelanggan dibersihkan (kecuali masih dipakai di undangan)
    const keep = new Set([...mediaUrls(parseStoredData(row.data)), ...mediaUrls(parseStoredData(json))]);
    for (const url of before) if (!keep.has(url)) await removeInvitationMedia(url);
    return { ok: true, status };
  }, { body: t.Object({ data: t.Record(t.String(), t.Unknown()), submit: t.Optional(t.Boolean()) }) })

  .post('/intake/:token/upload', async ({ params, body, request, set }) => {
    if (request.headers.get('x-requested-with') !== 'dyflorist') {
      set.status = 403;
      return { error: 'Permintaan ditolak' };
    }
    const row = await findInvitationByIntakeToken(params.token);
    if (!row || (row.intakeStatus !== 'open' && row.intakeStatus !== 'submitted')) {
      set.status = 404;
      return { error: 'Formulir tidak ditemukan atau sudah ditutup.' };
    }
    if (await rateLimited('intake-up', hashIp(clientIp(request)), 20, 10 * 60 * 1000)
      || await rateLimited(`iu:${row.id}`, 'all', 60, 60 * 60 * 1000)) {
      set.status = 429;
      return { error: 'Terlalu banyak unggahan. Coba lagi beberapa menit lagi.' };
    }
    const file = body.file;
    if (file.size > MAX_UPLOAD_BYTES) {
      set.status = 413;
      return { error: 'Foto terlalu besar (maks 4 MB)' };
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(buf);
    if (!type) {
      set.status = 415;
      return { error: 'Hanya foto JPG, PNG, atau WebP' };
    }
    const contentType = type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'image/jpeg';
    return { url: await storeImage(buf, type, contentType, 'invitations') };
  }, { body: t.Object({ file: t.File() }) })

  .get('/bespoke-prices', async () => {
    const rows = await getDb().select().from(schema.bespokePrices).orderBy(asc(schema.bespokePrices.sort));
    return rows.map((r) => ({ key: r.key, kind: r.kind, label: r.label, price: r.price }));
  })

  .get('/uploads/:name', async ({ params, set }) => {
    // Hanya untuk pengembangan lokal; di produksi foto ada di Vercel Blob
    if (isProd() || !/^[a-f0-9]{32}\.(jpg|png|webp|mp3)$/.test(params.name)) {
      set.status = 404;
      return { error: 'Tidak ditemukan' };
    }
    try {
      const data = await readFile(join(UPLOAD_DIR, params.name));
      const ext = params.name.split('.')[1];
      set.headers['content-type'] = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'mp3' ? 'audio/mpeg' : 'image/jpeg';
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
    // Batas total semua pengunjung (anti-banjir data dari banyak IP): maks 200 pesanan / jam
    if (await rateLimited('order-global', 'all', 200, 60 * 60 * 1000)) {
      set.status = 429;
      set.headers['retry-after'] = '600';
      return { error: 'Layanan sedang sibuk. Silakan hubungi kami lewat WhatsApp.' };
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
    const ip = clientIp(request);
    const ipHash = hashIp(ip);
    const gate = await loginGate(ipHash);
    if (gate.state === 'blocked') {
      set.status = 403;
      return { error: BLOCKED_MSG, blocked: true };
    }
    if (gate.state === 'locked') {
      set.status = 429;
      set.headers['retry-after'] = String(gate.retryAfter);
      return { error: `Login dikunci. Coba lagi dalam ${Math.ceil(gate.retryAfter / 60)} menit.` };
    }
    const stored = process.env.ADMIN_PASSWORD_HASH ?? '';
    const storedUndangan = process.env.INVITATION_ADMIN_PASSWORD_HASH ?? '';
    let role: AdminRole | null = null;
    if (stored && await verifyPassword(body.password, stored)) role = 'main';
    else if (storedUndangan && await verifyPassword(body.password, storedUndangan)) role = 'undangan';
    if (!role) {
      if (describeHash(stored) !== 'format benar') {
        console.error('Login admin gagal: ADMIN_PASSWORD_HASH ' + describeHash(stored));
      }
      const fail = await registerFailedLogin(ipHash);
      if (fail.state === 'blocked') {
        // Kirim email pemulihan (maks 3 email / jam agar kotak masuk tidak dibanjiri)
        if (!(await rateLimited('recovery_email', 'global', 3, 60 * 60 * 1000))) {
          const token = await createRecoveryToken();
          await sendBlockedAlert({ token, ip, userAgent: request.headers.get('user-agent') ?? '-' });
        }
        set.status = 403;
        return { error: BLOCKED_MSG, blocked: true };
      }
      if (fail.state === 'locked') {
        set.status = 429;
        set.headers['retry-after'] = String(fail.retryAfter);
        return { error: `3x password salah. Login dikunci ${LOCK_MS / 60000} menit.` };
      }
      set.status = 401;
      return { error: `Password salah. Sisa ${fail.remaining} percobaan sebelum dikunci ${LOCK_MS / 60000} menit.` };
    }
    await clearFailedLogins(ipHash);
    const { token, expires } = await createSession(role);
    set.headers['set-cookie'] = sessionCookie(token, expires);
    return { ok: true, role };
  }, { body: t.Object({ password: text(1, 200) }) })

  // ---------- Pemulihan blokir login (token dari email) ----------
  .post('/admin/recover', async ({ body, request, set }) => {
    const ipHash = hashIp(clientIp(request));
    if (await rateLimited('recover', ipHash, 10, 15 * 60 * 1000)) {
      set.status = 429;
      return { error: 'Terlalu banyak percobaan. Coba lagi nanti.' };
    }
    if (!(await useRecoveryToken(body.token))) {
      set.status = 400;
      return { error: 'Link pemulihan tidak valid, sudah dipakai, atau kedaluwarsa.' };
    }
    return { ok: true };
  }, { body: t.Object({ token: text(1, 100) }) })

  // ---------- Area admin (wajib login + CSRF) ----------
  .group('/admin', (admin) => admin
    .get('/session', async ({ request }) => ({ ok: true, role: await sessionRole(getCookie(request, SESSION_COOKIE)) }))

    .post('/logout', async ({ request, set }) => {
      await destroySession(getCookie(request, SESSION_COOKIE));
      set.headers['set-cookie'] = sessionCookie('', null);
      return { ok: true };
    })

    .post('/categories', async ({ body, set }) => {
      const db = getDb();
      const name = cleanText(body.name);
      const emoji = cleanText(body.emoji);
      if (!name) {
        set.status = 422;
        return { error: 'Nama kategori wajib diisi' };
      }
      const all = await db.select().from(schema.categories);
      if (all.length >= 30) {
        set.status = 409;
        return { error: 'Jumlah kategori sudah mencapai batas (30)' };
      }
      if (all.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        set.status = 409;
        return { error: 'Nama kategori sudah ada' };
      }
      const base = slugify(name);
      let key = base;
      for (let i = 2; all.some((c) => c.key === key); i++) key = `${base.slice(0, 26)}_${i}`;
      const sort = all.reduce((m, c) => Math.max(m, c.sort), 0) + 1;
      await db.insert(schema.categories).values({ key, name, emoji, sort });
      return { key };
    }, { body: t.Object({ name: text(1, 40), emoji: text(0, 16) }) })

    .put('/categories/:key', async ({ params, body, set }) => {
      const db = getDb();
      const name = cleanText(body.name);
      const emoji = cleanText(body.emoji);
      if (!name) {
        set.status = 422;
        return { error: 'Nama kategori wajib diisi' };
      }
      const [row] = await db.select().from(schema.categories).where(eq(schema.categories.key, params.key)).limit(1);
      if (!row) {
        set.status = 404;
        return { error: 'Kategori tidak ditemukan' };
      }
      const dupe = await db.select({ key: schema.categories.key }).from(schema.categories)
        .where(and(sql`lower(${schema.categories.name}) = ${name.toLowerCase()}`, ne(schema.categories.key, params.key)));
      if (dupe.length > 0) {
        set.status = 409;
        return { error: 'Nama kategori sudah ada' };
      }
      await db.update(schema.categories).set({ name, emoji }).where(eq(schema.categories.key, params.key));
      // Nama kategori juga disimpan di tiap produk: samakan
      await db.update(schema.products).set({ categoryName: name }).where(eq(schema.products.category, params.key));
      return { ok: true };
    }, { body: t.Object({ name: text(1, 40), emoji: text(0, 16) }) })

    .delete('/categories/:key', async ({ params, set }) => {
      const db = getDb();
      const [row] = await db.select().from(schema.categories).where(eq(schema.categories.key, params.key)).limit(1);
      if (!row) {
        set.status = 404;
        return { error: 'Kategori tidak ditemukan' };
      }
      const [used] = await db.select({ n: sql<number>`count(*)` }).from(schema.products)
        .where(eq(schema.products.category, params.key));
      if (Number(used.n) > 0) {
        set.status = 409;
        return { error: `Masih ada ${Number(used.n)} produk di kategori ini. Pindahkan atau hapus produknya dulu.` };
      }
      await db.delete(schema.categories).where(eq(schema.categories.key, params.key));
      return { ok: true };
    })

    .post('/products', async ({ body, set }) => {
      if (!isAllowedImage(body.image)) {
        set.status = 422;
        return { error: 'Foto tidak valid' };
      }
      const categoryName = await getCategoryName(body.category);
      if (!categoryName) {
        set.status = 422;
        return { error: 'Kategori tidak ditemukan' };
      }
      const id = 'prod_' + randomUUID().replace(/-/g, '').slice(0, 16);
      await getDb().insert(schema.products).values({
        id, ...body, originalPrice: normalizeOriginalPrice(body.price, body.originalPrice), demoUrl: body.demoUrl || null, categoryName, rating: 50, reviews: 1,
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
      const categoryName = await getCategoryName(body.category);
      if (!categoryName) {
        set.status = 422;
        return { error: 'Kategori tidak ditemukan' };
      }
      await db.update(schema.products)
        .set({ ...body, originalPrice: normalizeOriginalPrice(body.price, body.originalPrice), demoUrl: body.demoUrl || null, categoryName })
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

    .put('/bespoke-prices', async ({ body, set }) => {
      const db = getDb();
      const rows = await db.select().from(schema.bespokePrices);
      const byKey = new Map(rows.map((r) => [r.key, r]));
      for (const item of body.items) {
        const row = byKey.get(item.key);
        if (!row) {
          set.status = 422;
          return { error: 'Data harga tidak dikenal' };
        }
        if (row.kind === 'addon' && item.price === null) {
          set.status = 422;
          return { error: `Harga ${row.label} wajib diisi` };
        }
      }
      for (const item of body.items) {
        await db.update(schema.bespokePrices).set({ price: item.price }).where(eq(schema.bespokePrices.key, item.key));
      }
      return { ok: true };
    }, {
      body: t.Object({
        items: t.Array(t.Object({
          key: t.String({ minLength: 1, maxLength: 40, pattern: '^[a-z0-9_]+$' }),
          price: t.Union([t.Integer({ minimum: 0, maximum: 100_000_000 }), t.Null()]),
        }), { minItems: 1, maxItems: 50 }),
      }),
    })

    // ---------- Undangan digital (Admin Utama & Admin Undangan) ----------
    .get('/invitations', async () => {
      const db = getDb();
      // Arsipkan otomatis yang sudah lewat masa aktif, dan bersihkan link pratinjau yang kedaluwarsa
      await sweepExpired();
      await clearExpiredPreviews();
      const rows = await db.select().from(schema.invitations).orderBy(desc(schema.invitations.updatedAt)).limit(500);
      const counts = rows.length
        ? await db.select({
          id: schema.invitationWishes.invitationId,
          n: sql<number>`count(*)`,
          waiting: sql<number>`sum(case when ${schema.invitationWishes.status} = 'menunggu' then 1 else 0 end)`,
        }).from(schema.invitationWishes)
          .where(inArray(schema.invitationWishes.invitationId, rows.map((r) => r.id)))
          .groupBy(schema.invitationWishes.invitationId)
        : [];
      const byId = new Map(counts.map((c) => [c.id, c]));
      return rows.map((r) => {
        const d = parseStoredData(r.data);
        const c = byId.get(r.id);
        return {
          id: r.id, slug: r.slug, status: r.status, template: r.template,
          customerName: r.customerName, customerPhone: r.customerPhone,
          groom: d.couple.groom.nickname, bride: d.couple.bride.nickname, dateLabel: d.dateLabel,
          firstEvent: d.events.find((e) => e.startIso)?.startIso ?? '',
          wishes: Number(c?.n ?? 0), waiting: Number(c?.waiting ?? 0),
          updatedAt: r.updatedAt, publishedAt: r.publishedAt,
          expiresAt: expiresAtOf(r)?.toISOString() ?? null,
          intakeStatus: r.intakeStatus,
        };
      });
    })

    .post('/invitations', async ({ body, set }) => {
      const slug = body.slug.trim().toLowerCase();
      if (!isValidSlug(slug)) {
        set.status = 422;
        return { error: 'Alamat undangan hanya boleh huruf kecil, angka, dan strip (3–60 karakter)' };
      }
      if (await findInvitationBySlug(slug)) {
        set.status = 409;
        return { error: 'Alamat undangan sudah dipakai. Pilih alamat lain.' };
      }
      const data = newInvitationData();
      data.couple.groom.nickname = cleanText(body.groom ?? '').slice(0, 40);
      data.couple.bride.nickname = cleanText(body.bride ?? '').slice(0, 40);
      const [res] = await getDb().insert(schema.invitations).values({
        slug, status: 'draft', template: 'jawa-elegan',
        customerName: cleanText(body.customerName), customerPhone: cleanText(body.customerPhone), note: cleanText(body.note ?? ''),
        data: JSON.stringify(data),
      });
      return { id: Number(res.insertId), slug };
    }, {
      body: t.Object({
        slug: text(3, 60), customerName: text(0, 120), customerPhone: text(0, 30),
        note: t.Optional(text(0, 500)), groom: t.Optional(text(0, 40)), bride: t.Optional(text(0, 40)),
      }),
    })

    .get('/invitations/:id', async ({ params, set }) => {
      const row = await findInvitationById(Number(params.id));
      if (!row) {
        set.status = 404;
        return { error: 'Undangan tidak ditemukan' };
      }
      await archiveIfExpired(row);
      const fresh = (await findInvitationById(row.id)) ?? row;
      const data = parseStoredData(fresh.data);
      const intake = parseIntake(fresh.intakeData);
      const previewLive = !!fresh.previewToken && (toDate(fresh.previewExpiresAt)?.getTime() ?? 0) > Date.now();
      return {
        id: fresh.id, slug: fresh.slug, status: fresh.status, template: fresh.template,
        customerName: fresh.customerName, customerPhone: fresh.customerPhone, note: fresh.note,
        updatedAt: fresh.updatedAt, publishedAt: fresh.publishedAt,
        retentionDays: fresh.retentionDays, expiresAt: expiresAtOf(fresh)?.toISOString() ?? null,
        intake: {
          status: fresh.intakeStatus, token: fresh.intakeToken, submittedAt: fresh.intakeSubmittedAt,
          summary: intake ? intakeSummary(intake) : null,
        },
        preview: previewLive ? { token: fresh.previewToken, expiresAt: fresh.previewExpiresAt } : null,
        data, problems: publishProblems(data), stats: await attendanceStats(fresh.id),
      };
    }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) })

    .put('/invitations/:id', async ({ params, body, set }) => {
      const db = getDb();
      const row = await findInvitationById(Number(params.id));
      if (!row) {
        set.status = 404;
        return { error: 'Undangan tidak ditemukan' };
      }
      const slug = body.slug.trim().toLowerCase();
      if (slug !== row.slug) {
        if (!isValidSlug(slug)) {
          set.status = 422;
          return { error: 'Alamat undangan hanya boleh huruf kecil, angka, dan strip (3–60 karakter)' };
        }
        if (await findInvitationBySlug(slug)) {
          set.status = 409;
          return { error: 'Alamat undangan sudah dipakai. Pilih alamat lain.' };
        }
      }
      const data = normalizeInvitationData(body.data);
      if (row.status === 'terbit') {
        const problems = publishProblems(data);
        if (problems.length) {
          set.status = 422;
          return { error: `Undangan sudah terbit, data wajib tidak boleh kosong: ${problems.join('; ')}` };
        }
      }
      const json = JSON.stringify(data);
      if (json.length > 200_000) {
        set.status = 413;
        return { error: 'Isi undangan terlalu panjang' };
      }
      // Foto/musik lama yang tidak dipakai lagi dihapus dari penyimpanan (yang masih dipakai isian pelanggan tetap disimpan)
      const before = mediaUrls(parseStoredData(row.data));
      const after = new Set([...mediaUrls(data), ...(row.intakeData ? mediaUrls(parseStoredData(row.intakeData)) : [])]);
      await db.update(schema.invitations).set({
        slug, data: json, updatedAt: new Date(), retentionDays: body.retentionDays ?? row.retentionDays,
        customerName: cleanText(body.customerName), customerPhone: cleanText(body.customerPhone), note: cleanText(body.note),
      }).where(eq(schema.invitations.id, row.id));
      for (const url of before) if (!after.has(url)) await removeInvitationMedia(url);
      const saved = (await findInvitationById(row.id)) ?? row;
      return { ok: true, slug, data, problems: publishProblems(data), retentionDays: saved.retentionDays, expiresAt: expiresAtOf(saved)?.toISOString() ?? null };
    }, {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({
        slug: text(3, 60), customerName: text(0, 120), customerPhone: text(0, 30), note: text(0, 500),
        retentionDays: t.Optional(t.Union(RETENTION_OPTIONS.map((n) => t.Literal(n)))),
        data: t.Record(t.String(), t.Unknown()),
      }),
    })

    .post('/invitations/:id/status', async ({ params, body, set }) => {
      const row = await findInvitationById(Number(params.id));
      if (!row) {
        set.status = 404;
        return { error: 'Undangan tidak ditemukan' };
      }
      if (body.status === 'terbit') {
        const problems = publishProblems(parseStoredData(row.data));
        if (problems.length) {
          set.status = 422;
          return { error: `Belum bisa diterbitkan: ${problems.join('; ')}` };
        }
        const exp = expiresAtOf(row);
        if (exp && exp.getTime() <= Date.now()) {
          set.status = 422;
          return { error: 'Masa aktif undangan sudah lewat, jadi akan langsung diarsipkan lagi. Perpanjang masa aktif atau ubah tanggal acara dulu.' };
        }
      }
      await getDb().update(schema.invitations).set({
        status: body.status, updatedAt: new Date(),
        publishedAt: body.status === 'terbit' ? (row.publishedAt ?? new Date()) : row.publishedAt,
        // Link pratinjau pelanggan hangus begitu undangan terbit
        ...(body.status === 'terbit' ? { previewToken: null, previewExpiresAt: null } : {}),
      }).where(eq(schema.invitations.id, row.id));
      return { ok: true, status: body.status };
    }, {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ status: t.Union(INVITATION_STATUSES.map((s) => t.Literal(s))) }),
    })

    .delete('/invitations/:id', async ({ params, set }) => {
      const db = getDb();
      const row = await findInvitationById(Number(params.id));
      if (!row) {
        set.status = 404;
        return { error: 'Undangan tidak ditemukan' };
      }
      if (row.status === 'terbit') {
        set.status = 409;
        return { error: 'Undangan yang sedang terbit tidak bisa dihapus. Arsipkan dulu.' };
      }
      await db.delete(schema.invitationWishes).where(eq(schema.invitationWishes.invitationId, row.id));
      await db.delete(schema.invitations).where(eq(schema.invitations.id, row.id));
      const urls = [...mediaUrls(parseStoredData(row.data)), ...(row.intakeData ? mediaUrls(parseStoredData(row.intakeData)) : [])];
      for (const url of new Set(urls)) await removeInvitationMedia(url);
      return { ok: true };
    }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) })

    // Formulir data pelanggan: buka, tutup, atau ganti link
    .post('/invitations/:id/intake', async ({ params, body, set }) => {
      const row = await findInvitationById(Number(params.id));
      if (!row) {
        set.status = 404;
        return { error: 'Undangan tidak ditemukan' };
      }
      const regenerate = body.action === 'regenerate' || !row.intakeToken;
      const token = regenerate ? newToken() : row.intakeToken!;
      const status = body.action === 'close' ? 'closed' : 'open';
      await getDb().update(schema.invitations).set({ intakeToken: token, intakeStatus: status, updatedAt: new Date() })
        .where(eq(schema.invitations.id, row.id));
      return { ok: true, token, status };
    }, {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ action: t.Union([t.Literal('open'), t.Literal('close'), t.Literal('regenerate')]) }),
    })

    // Terapkan isian pelanggan ke undangan (yang kosong tidak menghapus data admin); formulir lalu dikunci
    .post('/invitations/:id/intake/apply', async ({ params, set }) => {
      const row = await findInvitationById(Number(params.id));
      const intake = row ? parseIntake(row.intakeData) : null;
      if (!row || !intake) {
        set.status = 404;
        return { error: 'Belum ada isian dari pelanggan' };
      }
      const before = parseStoredData(row.data);
      const merged = mergeIntake(before, intake);
      const after = new Set(mediaUrls(merged));
      await getDb().update(schema.invitations).set({
        data: JSON.stringify(merged), intakeStatus: 'applied', updatedAt: new Date(),
      }).where(eq(schema.invitations.id, row.id));
      for (const url of mediaUrls(before)) if (!after.has(url)) await removeInvitationMedia(url);
      return { ok: true, status: 'applied', data: merged, problems: publishProblems(merged) };
    }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) })

    // Link pratinjau rahasia untuk pelanggan (berlaku 14 hari, hangus saat undangan terbit)
    .post('/invitations/:id/preview-link', async ({ params, body, set }) => {
      const row = await findInvitationById(Number(params.id));
      if (!row) {
        set.status = 404;
        return { error: 'Undangan tidak ditemukan' };
      }
      if (row.status !== 'draft') {
        set.status = 409;
        return { error: 'Link pratinjau hanya untuk undangan berstatus Draft. Undangan terbit sudah bisa dibuka lewat link biasa.' };
      }
      if (body.action === 'revoke') {
        await getDb().update(schema.invitations).set({ previewToken: null, previewExpiresAt: null }).where(eq(schema.invitations.id, row.id));
        return { ok: true, preview: null };
      }
      const token = newToken();
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      await getDb().update(schema.invitations).set({ previewToken: token, previewExpiresAt: expiresAt }).where(eq(schema.invitations.id, row.id));
      return { ok: true, preview: { token, expiresAt } };
    }, {
      params: t.Object({ id: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ action: t.Union([t.Literal('create'), t.Literal('revoke')]) }),
    })

    // Unggah foto (JPG/PNG/WebP) atau musik (MP3) untuk undangan
    .post('/invitations/upload', async ({ body, set }) => {
      const file = body.file;
      if (file.size > MAX_UPLOAD_BYTES) {
        set.status = 413;
        return { error: 'Berkas terlalu besar (maks 4 MB)' };
      }
      const buf = new Uint8Array(await file.arrayBuffer());
      const type = detectImageType(buf);
      if (type) {
        const contentType = type === 'png' ? 'image/png' : type === 'webp' ? 'image/webp' : 'image/jpeg';
        return { url: await storeImage(buf, type, contentType, 'invitations'), kind: 'image' };
      }
      if (isMp3(buf)) return { url: await storeImage(buf, 'mp3', 'audio/mpeg', 'invitations'), kind: 'audio' };
      set.status = 415;
      return { error: 'Hanya foto JPG, PNG, WebP, atau musik MP3' };
    }, { body: t.Object({ file: t.File() }) })

    .get('/invitations/:id/wishes', async ({ params }) => {
      const rows = await getDb().select().from(schema.invitationWishes)
        .where(eq(schema.invitationWishes.invitationId, Number(params.id)))
        .orderBy(desc(schema.invitationWishes.createdAt), desc(schema.invitationWishes.id))
        .limit(2000);
      return rows.map((w) => ({
        id: w.id, name: w.name, message: w.message, attendance: w.attendance, guests: w.guests,
        status: w.status, createdAt: w.createdAt,
      }));
    }, { params: t.Object({ id: t.Numeric({ minimum: 1 }) }) })

    .patch('/invitations/:id/wishes/:wid', async ({ params, body }) => {
      await getDb().update(schema.invitationWishes).set({ status: body.status })
        .where(and(eq(schema.invitationWishes.id, Number(params.wid)), eq(schema.invitationWishes.invitationId, Number(params.id))));
      return { ok: true };
    }, {
      params: t.Object({ id: t.Numeric({ minimum: 1 }), wid: t.Numeric({ minimum: 1 }) }),
      body: t.Object({ status: t.Union([t.Literal('tampil'), t.Literal('sembunyi')]) }),
    })

    .delete('/invitations/:id/wishes/:wid', async ({ params }) => {
      await getDb().delete(schema.invitationWishes)
        .where(and(eq(schema.invitationWishes.id, Number(params.wid)), eq(schema.invitationWishes.invitationId, Number(params.id))));
      return { ok: true };
    }, { params: t.Object({ id: t.Numeric({ minimum: 1 }), wid: t.Numeric({ minimum: 1 }) }) })

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
