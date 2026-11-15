import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from './lib/password';

const PASSWORD = 'correct-horse-battery-staple';
const PASSWORD_UNDANGAN = 'undangan-elegan-jawa-2027';
const ORIGIN = 'http://localhost:5173';
process.env.ALLOWED_ORIGIN = ORIGIN;
process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD);
process.env.INVITATION_ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD_UNDANGAN);
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;

const { app } = await import('./app');
const { getDb, schema } = await import('./db');

let ipCounter = 0;
const newIp = () => `203.0.113.${++ipCounter}`;

function call(path: string, init: RequestInit & { ip?: string; admin?: boolean; cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-forwarded-for', init.ip ?? newIp());
  if (init.admin !== false && init.method && init.method !== 'GET') {
    headers.set('origin', ORIGIN);
    headers.set('x-requested-with', 'dyflorist');
  }
  if (init.cookie) headers.set('cookie', init.cookie);
  return app.handle(new Request('http://localhost' + path, { ...init, headers }));
}

const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

async function login(ip = newIp()): Promise<string> {
  const res = await call('/api/admin/login', { method: 'POST', ip, ...json({ password: PASSWORD }) });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie')!;
  return setCookie.split(';')[0];
}

async function loginUndangan(ip = newIp()): Promise<string> {
  const res = await call('/api/admin/login', { method: 'POST', ip, ...json({ password: PASSWORD_UNDANGAN }) });
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as any).role, 'undangan');
  return res.headers.get('set-cookie')!.split(';')[0];
}

before(async () => {
  const db = getDb();
  await db.delete(schema.invitationWishes);
  await db.delete(schema.invitations);
  await db.delete(schema.sessions);
  await db.delete(schema.loginAttempts);
  await db.delete(schema.loginBlocks);
  await db.delete(schema.rateEvents);
});

after(() => process.exit(0));

test('produk publik bisa dibaca tanpa login', async () => {
  const res = await call('/api/products');
  assert.equal(res.status, 200);
  const list = await res.json() as any[];
  assert.ok(list.length > 0);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('semua endpoint admin menolak request tanpa login (401)', async () => {
  const cases: [string, string][] = [
    ['GET', '/api/admin/session'], ['POST', '/api/admin/logout'], ['POST', '/api/admin/products'],
    ['PUT', '/api/admin/products/f1'], ['DELETE', '/api/admin/products/f1'], ['POST', '/api/admin/upload'],
    ['GET', '/api/admin/orders'], ['DELETE', '/api/admin/orders'],
  ];
  for (const [method, path] of cases) {
    const res = await call(path, { method });
    assert.equal(res.status, 401, `${method} ${path} harus 401, dapat ${res.status}`);
  }
});

test('cookie sesi palsu atau acak ditolak', async () => {
  for (const c of ['dyf_session=abc', 'dyf_session=' + 'a'.repeat(64), "dyf_session=' OR 1=1 --"]) {
    const res = await call('/api/admin/session', { cookie: c });
    assert.equal(res.status, 401);
  }
});

test('login salah ditolak dengan pesan generik', async () => {
  const res = await call('/api/admin/login', { method: 'POST', ...json({ password: 'salah' }) });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('login tanpa header CSRF / origin salah ditolak (403)', async () => {
  const noHeader = await call('/api/admin/login', { method: 'POST', admin: false, ...json({ password: PASSWORD }) });
  assert.equal(noHeader.status, 403);
  const badOrigin = await call('/api/admin/login', {
    method: 'POST', admin: false,
    headers: { origin: 'https://evil.example', 'x-requested-with': 'dyflorist', 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(badOrigin.status, 403);
});

test('CSRF: Origin sama dengan host situs diterima; Origin situs lain ditolak', async () => {
  const body = JSON.stringify({ password: PASSWORD });
  const mk = (origin: string) => call('/api/admin/login', {
    method: 'POST', admin: false,
    headers: { origin, 'x-requested-with': 'dyflorist', host: 'www.toko-saya.test', 'content-type': 'application/json' },
    body,
  });
  assert.equal((await mk('https://www.toko-saya.test')).status, 200); // same-origin
  assert.equal((await mk('https://evil.example')).status, 403);       // situs lain
  assert.equal((await mk('http://www.toko-saya.test')).status, 403);  // skema berbeda
});

test('login berhasil: cookie HttpOnly + SameSite=Strict, sesi valid, logout mencabut sesi', async () => {
  const ip = newIp();
  const res = await call('/api/admin/login', { method: 'POST', ip, ...json({ password: PASSWORD }) });
  assert.equal(res.status, 200);
  const sc = res.headers.get('set-cookie')!;
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /SameSite=Strict/);
  const cookie = sc.split(';')[0];
  assert.equal((await call('/api/admin/session', { cookie })).status, 200);
  assert.equal((await call('/api/admin/logout', { method: 'POST', cookie })).status, 200);
  assert.equal((await call('/api/admin/session', { cookie })).status, 401);
});

test('pemblokiran: 3x salah -> kunci 5 menit, salah lagi setelahnya -> blokir + pemulihan', async () => {
  const ip = newIp();
  const login = (password: string) => call('/api/admin/login', { method: 'POST', ip, ...json({ password }) });
  const r1 = await login('salah1');
  assert.equal(r1.status, 401);
  assert.match((await r1.json() as any).error, /Sisa 2/);
  assert.equal((await login('salah2')).status, 401);
  const r3 = await login('salah3');
  assert.equal(r3.status, 429);
  assert.equal(Number(r3.headers.get('retry-after')), 300);
  // selama dikunci, password benar pun ditolak
  assert.equal((await login(PASSWORD)).status, 429);
  // IP lain tidak terpengaruh
  assert.equal((await call('/api/admin/login', { method: 'POST', ip: newIp(), ...json({ password: PASSWORD }) })).status, 200);

  // kunci 5 menit berakhir (disimulasikan)
  await getDb().update(schema.loginBlocks).set({ lockedUntil: new Date(Date.now() - 1000) });
  const r4 = await login('salah4');
  assert.equal(r4.status, 403);
  assert.equal((await r4.json() as any).blocked, true);
  // diblokir: password benar tetap ditolak, tanpa batas waktu
  assert.equal((await login(PASSWORD)).status, 403);

  // pemulihan: token salah / format aneh ditolak, token benar membuka blokir & hanya sekali pakai
  const recover = (token: string) => call('/api/admin/recover', { method: 'POST', ...json({ token }) });
  assert.equal((await recover('a'.repeat(64))).status, 400);
  assert.equal((await recover('<script>')).status, 400);
  const { createRecoveryToken } = await import('./lib/security');
  const token = await createRecoveryToken();
  assert.equal((await recover(token)).status, 200);
  assert.equal((await recover(token)).status, 400);
  assert.equal((await login(PASSWORD)).status, 200);
  await getDb().delete(schema.loginAttempts);
  await getDb().delete(schema.loginBlocks);
});

test('pemulihan tanpa header CSRF ditolak', async () => {
  const res = await call('/api/admin/recover', { method: 'POST', admin: false, ...json({ token: 'a'.repeat(64) }) });
  assert.equal(res.status, 403);
});

test('request admin yang mengubah data tanpa CSRF header ditolak walau sudah login', async () => {
  const cookie = await login();
  const res = await call('/api/admin/products', { method: 'POST', admin: false, cookie, ...json({}) });
  assert.equal(res.status, 403);
});

test('produk: gambar javascript:/URL luar ditolak, data tidak valid 422', async () => {
  const cookie = await login();
  const base = { name: 'Tes', category: 'segar', price: 1000, badge: '', description: 'x' };
  for (const image of ['javascript:alert(1)', 'https://evil.example/x.jpg', 'data:text/html,<script>', '../etc/passwd']) {
    const res = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...base, image }) });
    assert.equal(res.status, 422, image);
  }
  const bad = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...base, price: -5, image: '/assets/logo.png' }) });
  assert.equal(bad.status, 422);
});

test('produk: tambah, ubah, hapus oleh admin', async () => {
  const cookie = await login();
  const body = { name: '<img src=x onerror=alert(1)>', category: 'gift_craft', price: 12345, badge: '', description: 'desc', image: '/assets/logo.png' };
  const created = await call('/api/admin/products', { method: 'POST', cookie, ...json(body) });
  assert.equal(created.status, 200);
  const { id } = await created.json() as { id: string };
  const upd = await call(`/api/admin/products/${id}`, { method: 'PUT', cookie, ...json({ ...body, price: 20000 }) });
  assert.equal(upd.status, 200);
  const list = await (await call('/api/products')).json() as any[];
  assert.equal(list.find((p) => p.id === id).price, 20000);
  assert.equal((await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie })).status, 404);
});

test('produk: harga coret hanya disimpan jika lebih tinggi dari harga jual', async () => {
  const cookie = await login();
  const body = { name: 'Uji Diskon', category: 'gift_craft', price: 250000, originalPrice: 310000, badge: '', description: 'desc', image: '/assets/logo.png' };
  const { id } = await (await call('/api/admin/products', { method: 'POST', cookie, ...json(body) })).json() as { id: string };
  const find = async () => ((await (await call('/api/products')).json()) as any[]).find((p) => p.id === id);
  assert.equal((await find()).originalPrice, 310000);
  // harga coret <= harga jual -> dikosongkan (tidak ada diskon palsu)
  await call(`/api/admin/products/${id}`, { method: 'PUT', cookie, ...json({ ...body, originalPrice: 200000 }) });
  assert.equal((await find()).originalPrice, null);
  // tanpa field -> kosong
  const { originalPrice: _, ...noOriginal } = body;
  await call(`/api/admin/products/${id}`, { method: 'PUT', cookie, ...json(noOriginal) });
  assert.equal((await find()).originalPrice, null);
  assert.equal((await call(`/api/admin/products/${id}`, { method: 'PUT', cookie, ...json({ ...body, originalPrice: -5 }) })).status, 422);
  await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie });
});

test('halaman bagikan produk: tag Open Graph berisi foto, teks di-escape, id aneh ditolak', async () => {
  const cookie = await login();
  const body = { name: 'Uji "Share" <b>', category: 'gift_craft', price: 150000, badge: '', description: 'Deskripsi & detail', image: '/assets/logo.png' };
  const { id } = await (await call('/api/admin/products', { method: 'POST', cookie, ...json(body) })).json() as { id: string };
  const res = await call(`/api/share/${id}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  const html = await res.text();
  assert.match(html, /<meta property="og:image" content="https:\/\/www\.dyflorist\.site\/assets\/logo\.png">/);
  assert.match(html, /Uji &quot;Share&quot; &lt;b&gt;/);
  assert.ok(!html.includes('<b>'));
  assert.match(html, new RegExp(`rel="canonical" href="[^"]*/katalog\\?produk=${id}"`));
  // /produk/:id lewat handler Vercel diarahkan ke halaman yang sama
  const { default: handler } = await import('./handler');
  // pengunjung biasa: langsung dialihkan ke katalog (302), pratinjau OG hanya untuk bot
  const human = await handler.fetch(new Request(`http://localhost/produk/${id}`, { headers: { 'x-forwarded-for': newIp() }, redirect: 'manual' }));
  assert.equal(human.status, 302);
  assert.equal(human.headers.get('location'), `/katalog?produk=${id}`);
  const viaHandler = await handler.fetch(new Request(`http://localhost/produk/${id}`, { headers: { 'x-forwarded-for': newIp(), 'user-agent': 'WhatsApp/2.23' } }));
  assert.equal(viaHandler.status, 200);
  assert.match(await viaHandler.text(), /og:image/);
  assert.equal((await call('/api/share/tidak-ada')).status, 404);
  assert.equal((await call('/api/share/..%2F..%2Fetc')).status, 404);
  await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie });
});

test('undangan digital: contoh bisa dibaca publik, slug lain 404', async () => {
  const res = await call('/api/invitations/demo');
  assert.equal(res.status, 200);
  const d = await res.json() as any;
  assert.equal(d.isDemo, true);
  assert.equal(d.couple.groom.nickname, 'Rizky');
  assert.ok(Array.isArray(d.events) && d.events.length >= 1);
  assert.equal((await call('/api/invitations/tidak-ada')).status, 404);
  assert.equal((await call('/api/invitations/..%2Fadmin')).status, 404);
});

test('harga Bespoke: publik bisa baca, ubah hanya admin dengan data valid', async () => {
  const list = await (await call('/api/bespoke-prices')).json() as any[];
  assert.ok(list.some((p) => p.key === 'hand_bouquet' && p.kind === 'type'));
  assert.ok(list.some((p) => p.key === 'chocolate' && p.kind === 'addon'));
  const put = (items: unknown, cookie?: string) => call('/api/admin/bespoke-prices', { method: 'PUT', cookie, ...json({ items }) });
  assert.equal((await put([{ key: 'hand_bouquet', price: 1000 }])).status, 401);
  const cookie = await login();
  assert.equal((await put([{ key: 'tidak_ada', price: 1000 }], cookie)).status, 422);
  assert.equal((await put([{ key: 'chocolate', price: null }], cookie)).status, 422);
  assert.equal((await put([{ key: 'hand_bouquet', price: -1 }], cookie)).status, 422);
  const before = list.find((p) => p.key === 'hand_bouquet').price;
  assert.equal((await put([{ key: 'hand_bouquet', price: null }], cookie)).status, 200);
  const after = await (await call('/api/bespoke-prices')).json() as any[];
  assert.equal(after.find((p) => p.key === 'hand_bouquet').price, null);
  assert.equal((await put([{ key: 'hand_bouquet', price: before }], cookie)).status, 200);
});

test('kategori: daftar publik tersedia, endpoint kelola butuh login', async () => {
  const res = await call('/api/categories');
  assert.equal(res.status, 200);
  const list = await res.json() as any[];
  assert.ok(list.length >= 7);
  assert.deepEqual(Object.keys(list[0]).sort(), ['emoji', 'key', 'name']);
  for (const [method, path] of [['POST', '/api/admin/categories'], ['PUT', '/api/admin/categories/segar'], ['DELETE', '/api/admin/categories/segar']]) {
    assert.equal((await call(path, { method })).status, 401, `${method} ${path}`);
  }
});

test('kategori: tambah, ubah nama (ikut ke produk), tolak duplikat, hapus hanya jika kosong', async () => {
  const cookie = await login();
  const nama = 'Hampers Wisuda ' + Date.now();
  const created = await call('/api/admin/categories', { method: 'POST', cookie, ...json({ name: nama, emoji: '🎓' }) });
  assert.equal(created.status, 200);
  const { key } = await created.json() as { key: string };
  assert.match(key, /^[a-z0-9_]+$/);

  // nama sama (beda huruf besar/kecil) ditolak
  const dupe = await call('/api/admin/categories', { method: 'POST', cookie, ...json({ name: nama.toUpperCase(), emoji: '' }) });
  assert.equal(dupe.status, 409);

  // produk di kategori baru
  const body = { name: 'Produk Kategori Uji', category: key, price: 5000, badge: '', description: 'x', image: '/assets/logo.png' };
  const prod = await call('/api/admin/products', { method: 'POST', cookie, ...json(body) });
  assert.equal(prod.status, 200);
  const { id } = await prod.json() as { id: string };

  // kategori yang tidak ada ditolak
  const bad = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...body, category: 'tidak_ada' }) });
  assert.equal(bad.status, 422);

  // tidak boleh dihapus selama masih ada produk
  assert.equal((await call(`/api/admin/categories/${key}`, { method: 'DELETE', cookie })).status, 409);

  // ganti nama -> nama pada produk ikut berubah
  const baru = nama + ' Baru';
  assert.equal((await call(`/api/admin/categories/${key}`, { method: 'PUT', cookie, ...json({ name: baru, emoji: '🎓' }) })).status, 200);
  const list = await (await call('/api/products')).json() as any[];
  assert.equal(list.find((p) => p.id === id).categoryName, baru);

  // kosongkan lalu hapus
  assert.equal((await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await call(`/api/admin/categories/${key}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await call(`/api/admin/categories/${key}`, { method: 'DELETE', cookie })).status, 404);
});

test('kategori: karakter < > dibuang dari nama dan emoji', async () => {
  const cookie = await login();
  const res = await call('/api/admin/categories', {
    method: 'POST', cookie, ...json({ name: '<b>x</b>Uji' + Date.now(), emoji: '<b>' }),
  });
  assert.equal(res.status, 200);
  const { key } = await res.json() as { key: string };
  const list = await (await call('/api/categories')).json() as any[];
  const cat = list.find((c) => c.key === key);
  assert.ok(!/[<>]/.test(cat.name) && !/[<>]/.test(cat.emoji));
  await call(`/api/admin/categories/${key}`, { method: 'DELETE', cookie });
});

test('upload: file palsu (teks berekstensi .jpg) ditolak, PNG asli diterima', async () => {
  const cookie = await login();
  const fake = new FormData();
  fake.set('file', new File(['<script>alert(1)</script>'], 'x.jpg', { type: 'image/jpeg' }));
  const r1 = await call('/api/admin/upload', { method: 'POST', cookie, body: fake });
  assert.equal(r1.status, 415);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const ok = new FormData();
  ok.set('file', new File([png], 'a.png', { type: 'image/png' }));
  const r2 = await call('/api/admin/upload', { method: 'POST', cookie, body: ok });
  assert.equal(r2.status, 200);
  const { url } = await r2.json() as { url: string };
  assert.match(url, /^\/api\/uploads\/[a-f0-9]{32}\.png$/);
  assert.equal((await call(url)).status, 200);
});

test('upload tanpa login ditolak', async () => {
  const fd = new FormData();
  fd.set('file', new File([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0])], 'a.png'));
  const res = await call('/api/admin/upload', { method: 'POST', body: fd });
  assert.equal(res.status, 401);
});

test('pesanan: total dihitung server, harga dari klien diabaikan', async () => {
  const products = await (await call('/api/products')).json() as any[];
  const p = products[0];
  const res = await call('/api/orders', {
    method: 'POST', admin: false,
    ...json({ recipient: 'Budi', scheduled: 'Besok', note: '', items: [{ id: p.id, qty: 2, price: 1 }] }),
  });
  // properti ekstra (price) tidak boleh mengubah hasil; boleh ditolak atau diabaikan
  if (res.status === 200) {
    const { total } = await res.json() as { total: number };
    assert.equal(total, p.price * 2);
  } else {
    assert.equal(res.status, 422);
  }
  const clean = await call('/api/orders', {
    method: 'POST', admin: false,
    ...json({ recipient: 'Budi', scheduled: 'Besok', note: '', items: [{ id: p.id, qty: 2 }] }),
  });
  assert.equal(clean.status, 200);
  assert.equal((await clean.json() as any).total, p.price * 2);
});

test('pesanan: produk tidak dikenal, qty tidak wajar, teks terlalu panjang ditolak', async () => {
  const mk = (items: any, extra: any = {}) => call('/api/orders', {
    method: 'POST', admin: false, ...json({ recipient: 'A', scheduled: 'B', note: '', items, ...extra }),
  });
  assert.equal((await mk([{ id: 'tidak-ada', qty: 1 }])).status, 400);
  assert.equal((await mk([{ id: 'satin_blush_ruffle', qty: 0 }])).status, 422);
  assert.equal((await mk([{ id: 'satin_blush_ruffle', qty: 9999 }])).status, 422);
  assert.equal((await mk([])).status, 422);
  assert.equal((await mk([{ id: 'satin_blush_ruffle', qty: 1 }], { note: 'x'.repeat(501) })).status, 422);
});

test('pesanan: rate limit per IP (maks 5 / 10 menit)', async () => {
  const ip = newIp();
  const send = () => call('/api/orders', {
    method: 'POST', admin: false, ip,
    ...json({ recipient: 'A', scheduled: 'B', note: '', items: [{ id: 'satin_blush_ruffle', qty: 1 }] }),
  });
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
});

test('rate limiter: batas tercapai lalu diblokir, bucket lain tidak terpengaruh', async () => {
  const { rateLimited } = await import('./lib/security');
  const bucket = 'tes-' + Date.now();
  for (let i = 0; i < 3; i++) assert.equal(await rateLimited(bucket, 'all', 3, 60_000), false);
  assert.equal(await rateLimited(bucket, 'all', 3, 60_000), true);
  assert.equal(await rateLimited(bucket + 'b', 'all', 3, 60_000), false);
});

test('pesanan: payload XSS disimpan apa adanya tapi hanya admin yang bisa membaca daftar', async () => {
  const xss = '<script>alert(1)</script>';
  const o = await call('/api/orders', {
    method: 'POST', admin: false,
    ...json({ recipient: xss, scheduled: 'x', note: xss, items: [{ id: 'satin_blush_ruffle', qty: 1 }] }),
  });
  assert.equal(o.status, 200);
  assert.equal((await call('/api/admin/orders')).status, 401);
  const cookie = await login();
  const list = await (await call('/api/admin/orders', { cookie })).json() as any[];
  assert.ok(list.some((x) => x.recipient === xss)); // frontend wajib meng-escape saat menampilkan
});

// ---------- Undangan digital (tahap 2) ----------
const FILLED = {
  couple: {
    groom: { nickname: 'Bima', fullName: 'Bima Saputra', photo: 'javascript:alert(1)', instagram: '@bima.ok', hacker: 'x' },
    bride: { nickname: 'Sekar', fullName: 'Sekar Ayu', photo: 'https://evil.example/x.jpg', instagram: 'bad handle!' },
  },
  dateLabel: 'Minggu, 5 September 2027',
  events: [
    { title: 'Akad', startIso: '2027-09-05T08:00:00+07:00', endIso: '2027-09-05T10:00:00+07:00', mapsUrl: 'https://maps.app.goo.gl/abc', venueName: 'Masjid <b>Contoh</b>' },
    { title: 'Resepsi', startIso: 'bukan-tanggal', mapsUrl: 'javascript:alert(1)' },
  ],
  photos: { cover: '/assets/undangan/og-undangan.jpg', gallery: ['/assets/a.jpg', 'http://x/y.jpg'] },
  music: { src: '/assets/undangan/foto/bunga-krem.webp' },
  rsvp: { enabled: true, maxGuests: 99 },
  wishes: { enabled: true, requireApproval: false },
  extra: 'dibuang',
};

async function createInvitation(cookie: string, slug: string) {
  const res = await call('/api/admin/invitations', { method: 'POST', cookie, ...json({ slug, customerName: 'Pelanggan Uji', customerPhone: '0812000' }) });
  assert.equal(res.status, 200);
  return ((await res.json()) as any).id as number;
}
async function saveInvitation(cookie: string, id: number, slug: string, data: unknown) {
  return call(`/api/admin/invitations/${id}`, { method: 'PUT', cookie, ...json({ slug, customerName: 'Pelanggan Uji', customerPhone: '0812000', note: '', data }) });
}
const wish = (slug: string, body: unknown, ip = newIp(), header = true) => call(`/api/invitations/${slug}/wishes`, {
  method: 'POST', admin: false, ip,
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...(header ? { 'x-requested-with': 'dyflorist' } : {}) },
});

test('Admin Undangan: login terpisah, hanya bisa membuka menu undangan', async () => {
  const cookie = await loginUndangan();
  const s = await call('/api/admin/session', { cookie });
  assert.equal(((await s.json()) as any).role, 'undangan');
  assert.equal((await call('/api/admin/invitations', { cookie })).status, 200);
  for (const [method, path] of [['GET', '/api/admin/orders'], ['POST', '/api/admin/products'], ['POST', '/api/admin/upload'], ['PUT', '/api/admin/bespoke-prices'], ['DELETE', '/api/admin/orders']]) {
    const res = await call(path, { method, cookie });
    assert.equal(res.status, 403, `${method} ${path} harus 403 untuk Admin Undangan, dapat ${res.status}`);
  }
  // Admin utama tetap bisa mengelola undangan
  const main = await login();
  assert.equal(((await (await call('/api/admin/session', { cookie: main })).json()) as any).role, 'main');
  assert.equal((await call('/api/admin/invitations', { cookie: main })).status, 200);
  // Tanpa login: 401
  assert.equal((await call('/api/admin/invitations')).status, 401);
  assert.equal((await call('/api/admin/invitations', { method: 'POST', ...json({ slug: 'x-y-z', customerName: '', customerPhone: '' }) })).status, 401);
});

test('undangan: alamat (slug) divalidasi, dicadangkan, dan tidak boleh ganda', async () => {
  const cookie = await loginUndangan();
  for (const slug of ['Bima Sekar', 'ab', '-awal', 'akhir-', 'demo', 'admin', 'a--b', '../etc']) {
    const res = await call('/api/admin/invitations', { method: 'POST', cookie, ...json({ slug, customerName: '', customerPhone: '' }) });
    assert.ok([422].includes(res.status), `slug "${slug}" harus ditolak, dapat ${res.status}`);
  }
  await createInvitation(cookie, 'slug-ganda');
  const dup = await call('/api/admin/invitations', { method: 'POST', cookie, ...json({ slug: 'slug-ganda', customerName: '', customerPhone: '' }) });
  assert.equal(dup.status, 409);
});

test('undangan: isian dirapikan server (media/peta/IG tidak aman dibuang, field asing dibuang)', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'bima-sekar-rapi');
  const res = await saveInvitation(cookie, id, 'bima-sekar-rapi', FILLED);
  assert.equal(res.status, 200);
  const { data } = await res.json() as any;
  assert.equal(data.couple.groom.photo, '');
  assert.equal(data.couple.bride.photo, '');
  assert.equal(data.couple.groom.instagram, 'bima.ok');
  assert.equal(data.couple.bride.instagram, '');
  assert.equal(data.couple.groom.hacker, undefined);
  assert.equal(data.extra, undefined);
  assert.equal(data.events[0].mapsUrl, 'https://maps.app.goo.gl/abc');
  assert.equal(data.events[1].mapsUrl, '');
  assert.equal(data.events[1].startIso, '');
  assert.equal(data.events[0].venueName, 'Masjid <b>Contoh</b>'); // disimpan sebagai teks, halaman menampilkan lewat textContent
  assert.deepEqual(data.photos.gallery, ['/assets/a.jpg']);
  assert.equal(data.music.src, ''); // bukan MP3
  assert.equal(data.rsvp.maxGuests, 10);
});

test('undangan: draft hanya bisa dilihat admin, terbit publik, arsip 410, data pelanggan tidak bocor', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'bima-sekar');
  // Belum lengkap: tidak bisa terbit
  const early = await call(`/api/admin/invitations/${id}/status`, { method: 'POST', cookie, ...json({ status: 'terbit' }) });
  assert.equal(early.status, 422);
  assert.equal((await saveInvitation(cookie, id, 'bima-sekar', FILLED)).status, 200);

  assert.equal((await call('/api/invitations/bima-sekar')).status, 404); // draft, tanpa login
  const preview = await call('/api/invitations/bima-sekar', { cookie });
  assert.equal(preview.status, 200);
  assert.equal(((await preview.json()) as any).isPreview, true);
  assert.equal(preview.headers.get('cache-control'), 'no-store');

  assert.equal((await call(`/api/admin/invitations/${id}/status`, { method: 'POST', cookie, ...json({ status: 'terbit' }) })).status, 200);
  const pub = await call('/api/invitations/bima-sekar');
  assert.equal(pub.status, 200);
  assert.match(pub.headers.get('cache-control') ?? '', /s-maxage=10/); // aman di-cache CDN saat tamu banyak
  assert.equal(preview.headers.get('cache-control'), 'no-store');
  const raw = await pub.text();
  const d = JSON.parse(raw);
  assert.equal(d.couple.groom.nickname, 'Bima');
  assert.equal(d.isPreview, false);
  assert.ok(!raw.includes('0812000') && !raw.includes('Pelanggan Uji'), 'nomor/nama pemesan tidak boleh ikut ke publik');

  // Sedang terbit: tidak bisa dihapus, data wajib tidak boleh dikosongkan
  assert.equal((await call(`/api/admin/invitations/${id}`, { method: 'DELETE', cookie })).status, 409);
  assert.equal((await saveInvitation(cookie, id, 'bima-sekar', { ...FILLED, couple: { groom: {}, bride: {} } })).status, 422);

  assert.equal((await call(`/api/admin/invitations/${id}/status`, { method: 'POST', cookie, ...json({ status: 'arsip' }) })).status, 200);
  assert.equal((await call('/api/invitations/bima-sekar')).status, 410);
  assert.equal((await call(`/api/admin/invitations/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await call('/api/invitations/bima-sekar')).status, 404);
});

test('ucapan tamu: tersimpan, tampil, statistik kehadiran, moderasi, dan perlindungan', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'ucapan-uji');
  await saveInvitation(cookie, id, 'ucapan-uji', FILLED);
  assert.equal((await wish('ucapan-uji', { name: 'A', message: 'B', attendance: 'hadir' })).status, 404); // masih draft
  await call(`/api/admin/invitations/${id}/status`, { method: 'POST', cookie, ...json({ status: 'terbit' }) });

  assert.equal((await wish('ucapan-uji', { name: 'A', message: 'B', attendance: 'hadir' }, newIp(), false)).status, 403); // tanpa header
  assert.equal((await wish('ucapan-uji', { name: 'A', message: 'B' })).status, 422); // kehadiran wajib
  assert.equal((await wish('ucapan-uji', { name: 'A', message: 'B', attendance: 'mungkin' })).status, 422);
  assert.equal((await wish('ucapan-uji', { name: 'A'.repeat(61), message: 'B', attendance: 'hadir' })).status, 422);

  const ok = await wish('ucapan-uji', { name: '<img src=x onerror=alert(1)>', message: 'Selamat!', attendance: 'hadir', guests: 9 });
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as any).status, 'tampil');
  await wish('ucapan-uji', { name: 'Tamu Dua', message: 'Maaf tidak bisa hadir', attendance: 'tidak' });

  let d = await (await call('/api/invitations/ucapan-uji')).json() as any;
  assert.equal(d.wishes.items.length, 2);
  assert.equal(d.wishes.items[1].name, '<img src=x onerror=alert(1)>'); // disimpan sebagai teks
  assert.deepEqual(d.rsvp.stats, { hadir: 1, tidak: 1, ragu: 0 });
  assert.equal(d.wishes.items[0].ipHash, undefined);

  // Admin: jumlah tamu dibatasi maxGuests (10), sembunyikan ucapan
  const detail = await (await call(`/api/admin/invitations/${id}`, { cookie })).json() as any;
  assert.equal(detail.stats.tamuHadir, 9);
  const list = await (await call(`/api/admin/invitations/${id}/wishes`, { cookie })).json() as any[];
  const target = list.find((w) => w.name === 'Tamu Dua');
  assert.equal((await call(`/api/admin/invitations/${id}/wishes/${target.id}`, { method: 'PATCH', cookie, ...json({ status: 'sembunyi' }) })).status, 200);
  d = await (await call('/api/invitations/ucapan-uji')).json() as any;
  assert.equal(d.wishes.items.length, 1);
  assert.deepEqual(d.rsvp.stats, { hadir: 1, tidak: 0, ragu: 0 });

  // Persetujuan admin: ucapan baru menunggu, belum tampil, tetap terhitung kehadirannya
  await saveInvitation(cookie, id, 'ucapan-uji', { ...FILLED, wishes: { enabled: true, requireApproval: true } });
  const pending = await wish('ucapan-uji', { name: 'Tamu Tiga', message: 'Insya Allah', attendance: 'ragu' });
  assert.equal(((await pending.json()) as any).status, 'menunggu');
  d = await (await call('/api/invitations/ucapan-uji')).json() as any;
  assert.ok(!d.wishes.items.some((w: any) => w.name === 'Tamu Tiga'));
  assert.equal(d.rsvp.stats.ragu, 1);

  // Rate limit: maks 30 ucapan / 10 menit per IP per undangan (tamu satu gedung berbagi WiFi)
  const ip = newIp();
  for (let i = 0; i < 30; i++) assert.equal((await wish('ucapan-uji', { name: 'Tamu WiFi', message: `ke-${i}`, attendance: 'hadir' }, ip)).status, 200, `ucapan ke-${i + 1} harus diterima`);
  assert.equal((await wish('ucapan-uji', { name: 'Spam', message: 'ke-31', attendance: 'hadir' }, ip)).status, 429);
  // IP lain di undangan yang sama tidak terpengaruh
  assert.equal((await wish('ucapan-uji', { name: 'Tamu Lain', message: 'halo', attendance: 'hadir' })).status, 200);
});

test('tanggal & jam di undangan selalu mengikuti tanggal acara (tidak bisa basi)', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'tanggal-uji');
  const stale = { ...FILLED, dateLabel: 'Senin, 1 Januari 2020', events: [{ title: 'Akad', startIso: '2027-09-05T08:00:00+07:00', endIso: '2027-09-05T10:00:00+07:00', timeLabel: 'basi', dateLabel: 'basi' }] };
  let out = await (await saveInvitation(cookie, id, 'tanggal-uji', stale)).json() as any;
  assert.equal(out.data.dateLabel, 'Minggu, 5 September 2027');
  assert.equal(out.data.events[0].dateLabel, 'Minggu, 5 September 2027');
  assert.equal(out.data.events[0].timeLabel, '08.00 – 10.00 WIB');
  // Ganti tanggal: sampul ikut berubah. Dua acara -> sampul memakai yang paling awal.
  out = await (await saveInvitation(cookie, id, 'tanggal-uji', {
    ...stale,
    events: [
      { title: 'Resepsi', startIso: '2027-12-25T11:00:00+08:00' },
      { title: 'Akad', startIso: '2027-12-24T08:30:00+08:00', endIso: '2027-12-24T09:30:00+08:00' },
    ],
  })).json() as any;
  assert.equal(out.data.dateLabel, 'Jumat, 24 Desember 2027');
  assert.equal(out.data.events[1].timeLabel, '08.30 – 09.30 WITA');
  assert.equal(out.data.events[0].timeLabel, '11.00 – Selesai WITA');
  // Isian manual hanya dipakai bila belum ada acara bertanggal
  out = await (await saveInvitation(cookie, id, 'tanggal-uji', { ...FILLED, dateLabel: 'Minggu depan', events: [{ title: 'Akad' }] })).json() as any;
  assert.equal(out.data.dateLabel, 'Minggu depan');
});

test('pratinjau link undangan (WhatsApp): judul nama mempelai, nama tamu di-escape, draft tidak bocor', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'og-uji');
  await saveInvitation(cookie, id, 'og-uji', FILLED);
  let html = await (await call('/api/invitation-share/og-uji')).text();
  assert.ok(!html.includes('Bima'), 'draft tidak boleh tampil di pratinjau');
  await call(`/api/admin/invitations/${id}/status`, { method: 'POST', cookie, ...json({ status: 'terbit' }) });
  const res = await call('/api/invitation-share/og-uji?to=' + encodeURIComponent('<script>x</script> Pak "Budi"'));
  assert.equal(res.status, 200);
  html = await res.text();
  assert.ok(html.includes('og:title" content="The Wedding of Bima &amp; Sekar"'));
  assert.ok(html.includes('og:image" content="https://www.dyflorist.site/assets/undangan/og-undangan.jpg"'));
  assert.ok(!html.includes('<script>') && !html.includes('&lt;'), 'karakter berbahaya dibuang dari nama tamu');
  assert.ok(html.includes('Kepada Yth.'));
  // Teks yang mirip tautan/alamat web dibuang seluruhnya (anti pesan palsu di kartu pratinjau)
  for (const bad of ['Klik https://evil.example', 'Hadiah di promo.shop', 'kirim@evil.com']) {
    const h = await (await call('/api/invitation-share/og-uji?to=' + encodeURIComponent(bad))).text();
    assert.ok(!/evil|promo|Klik|Hadiah/.test(h) && !h.includes('Kepada Yth.'), `"${bad}" tidak boleh tampil`);
  }
  const ok = await (await call('/api/invitation-share/og-uji?to=' + encodeURIComponent('Bapak Budi Santoso & Keluarga'))).text();
  assert.ok(ok.includes('Kepada Yth. Bapak Budi Santoso &amp; Keluarga'));
  const demo = await (await call('/api/invitation-share/demo')).text();
  assert.ok(demo.includes('Rizky &amp; Nadia'));
});

test('unggah undangan: MP3 & foto diterima, file lain ditolak', async () => {
  const cookie = await loginUndangan();
  const send = async (bytes: number[], name: string) => {
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([...bytes, ...new Array(64).fill(0)])], name));
    return call('/api/admin/invitations/upload', { method: 'POST', cookie, body: fd });
  };
  const mp3 = await send([0x49, 0x44, 0x33, 0x04], 'lagu.mp3');
  assert.equal(mp3.status, 200);
  assert.match(((await mp3.json()) as any).url, /^\/api\/uploads\/[a-f0-9]{32}\.mp3$/);
  assert.equal((await send([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'foto.png')).status, 200);
  assert.equal((await send([0x3c, 0x73, 0x76, 0x67], 'gambar.svg')).status, 415);
  assert.equal((await send([0x4d, 0x5a], 'virus.mp3')).status, 415);
});

test('produk: link demo undangan hanya boleh halaman undangan situs ini', async () => {
  const cookie = await login();
  const base = { name: 'Undangan Jawa Elegan', category: 'undangan', price: 150000, badge: '', description: 'Undangan digital', image: '/assets/produk-1.jpg' };
  const bad = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...base, demoUrl: 'https://evil.example/undangan' }) });
  assert.equal(bad.status, 422);
  const res = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...base, demoUrl: '/undangan/demo' }) });
  if (res.status === 422) return; // kategori "undangan" tidak ada di database uji
  assert.equal(res.status, 200);
  const { id } = await res.json() as any;
  const list = await (await call('/api/products')).json() as any[];
  assert.equal(list.find((p) => p.id === id).demoUrl, '/undangan/demo');
  await call(`/api/admin/products/${id}`, { method: 'DELETE', cookie });
});

// ---------- Alur kerja undangan: pratinjau pelanggan, formulir data, masa aktif ----------
const intakePut = (token: string, body: unknown, header = true, ip = newIp()) => call(`/api/intake/${token}`, {
  method: 'PUT', admin: false, ip, body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...(header ? { 'x-requested-with': 'dyflorist' } : {}) },
});
const post = (cookie: string, path: string, body: unknown) => call(path, { method: 'POST', cookie, ...json(body) });

test('pratinjau pelanggan: link rahasia membuka draft, salah/kedaluwarsa ditolak, hangus saat terbit', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'pratinjau-uji');
  await saveInvitation(cookie, id, 'pratinjau-uji', FILLED);

  const created = await (await post(cookie, `/api/admin/invitations/${id}/preview-link`, { action: 'create' })).json() as any;
  const token = created.preview.token as string;
  assert.match(token, /^[a-f0-9]{48}$/);

  const ok = await call(`/api/invitations/pratinjau-uji?preview=${token}`);
  assert.equal(ok.status, 200);
  assert.equal(((await ok.json()) as any).isPreview, true);
  assert.equal((await call('/api/invitations/pratinjau-uji')).status, 404); // tanpa token tetap tertutup
  assert.equal((await call('/api/invitations/pratinjau-uji?preview=' + 'a'.repeat(48))).status, 403);
  // Pratinjau tidak menyimpan ucapan (draft tidak menerima kiriman)
  assert.equal((await wish('pratinjau-uji', { name: 'A', message: 'B', attendance: 'hadir' })).status, 404);
  // Halaman bagikan link draft tidak membocorkan nama
  const og = await (await call('/api/invitation-share/pratinjau-uji')).text();
  assert.ok(!og.includes('Bima') && og.includes('Pratinjau'));

  // Kedaluwarsa
  await getDb().update(schema.invitations).set({ previewExpiresAt: new Date(Date.now() - 1000) }).where((await import('drizzle-orm')).eq(schema.invitations.id, id));
  assert.equal((await call(`/api/invitations/pratinjau-uji?preview=${token}`)).status, 403);

  // Link baru, lalu terbit -> hangus
  const again = await (await post(cookie, `/api/admin/invitations/${id}/preview-link`, { action: 'create' })).json() as any;
  await post(cookie, `/api/admin/invitations/${id}/status`, { status: 'terbit' });
  const detail = await (await call(`/api/admin/invitations/${id}`, { cookie })).json() as any;
  assert.equal(detail.preview, null);
  // Undangan terbit: link pratinjau hanya untuk draft
  assert.equal((await post(cookie, `/api/admin/invitations/${id}/preview-link`, { action: 'create' })).status, 409);
  assert.equal((await call(`/api/invitations/pratinjau-uji?preview=${again.preview.token}`)).status, 200);
});

test('formulir data pelanggan: link rahasia, validasi, kirim, terapkan, tutup', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'formulir-uji');
  assert.equal((await call('/api/intake/' + 'a'.repeat(48))).status, 404);
  const opened = await (await post(cookie, `/api/admin/invitations/${id}/intake`, { action: 'open' })).json() as any;
  const token = opened.token as string;
  assert.match(token, /^[a-f0-9]{48}$/);
  assert.equal((await call('/api/intake/tidak-valid')).status, 404);

  const form = await (await call(`/api/intake/${token}`)).json() as any;
  assert.equal(form.editable, true);
  assert.equal(form.data.settings, undefined); // pengaturan & musik bukan urusan pelanggan
  assert.equal(form.data.rsvp, undefined);

  assert.equal((await intakePut(token, { data: {} }, false)).status, 403); // tanpa header
  const mine = {
    couple: { groom: { nickname: 'Bima', fullName: 'Bima Saputra', photo: 'https://evil.example/x.jpg', instagram: '@bima.ok' }, bride: { nickname: 'Sekar' } },
    events: [{ title: 'Akad', startIso: '2027-09-05T08:00:00+07:00', mapsUrl: 'javascript:alert(1)' }],
    gifts: { accounts: [{ bank: 'BCA', number: '123', name: 'Bima' }] },
    music: { src: '/assets/undangan/contoh/musik-contoh.mp3' }, // diabaikan
    wishes: { enabled: false }, // diabaikan
  };
  assert.equal((await intakePut(token, { data: mine })).status, 200);
  let list = await (await call('/api/admin/invitations', { cookie })).json() as any[];
  assert.equal(list.find((r) => r.id === id).intakeStatus, 'open');

  assert.equal((await intakePut(token, { data: mine, submit: true })).status, 200);
  let detail = await (await call(`/api/admin/invitations/${id}`, { cookie })).json() as any;
  assert.equal(detail.intake.status, 'submitted');
  assert.deepEqual(detail.intake.summary, { mempelai: 2, acara: 1, kisah: 0, foto: 0, rekening: 1 });
  assert.equal(detail.data.couple.groom.fullName, ''); // belum diterapkan
  assert.equal(detail.data.music.src, ''); // musik dari pelanggan tidak masuk

  const applied = await post(cookie, `/api/admin/invitations/${id}/intake/apply`, {});
  assert.equal(applied.status, 200);
  detail = await (await call(`/api/admin/invitations/${id}`, { cookie })).json() as any;
  assert.equal(detail.intake.status, 'applied');
  assert.equal(detail.data.couple.groom.fullName, 'Bima Saputra');
  assert.equal(detail.data.couple.groom.photo, ''); // alamat foto luar ditolak
  assert.equal(detail.data.couple.groom.instagram, 'bima.ok');
  assert.equal(detail.data.events[0].mapsUrl, '');
  assert.equal(detail.data.greeting.salam, 'Assalamu’alaikum Warahmatullahi Wabarakatuh'); // data admin tidak terhapus
  assert.equal(detail.data.wishes.enabled, true);

  // Terkunci setelah diterapkan, bisa dibuka lagi; ganti link mematikan link lama
  assert.equal((await intakePut(token, { data: mine })).status, 409);
  const reopened = await (await post(cookie, `/api/admin/invitations/${id}/intake`, { action: 'regenerate' })).json() as any;
  assert.notEqual(reopened.token, token);
  assert.equal((await call(`/api/intake/${token}`)).status, 404);
  assert.equal((await intakePut(reopened.token, { data: mine })).status, 200);
  await post(cookie, `/api/admin/invitations/${id}/intake`, { action: 'close' });
  assert.equal((await intakePut(reopened.token, { data: mine })).status, 409);
  assert.equal(((await (await call(`/api/intake/${reopened.token}`)).json()) as any).editable, false);
});

test('formulir pelanggan: unggah hanya foto & hanya saat formulir terbuka', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'unggah-pelanggan');
  const send = async (token: string, bytes: number[], header = true) => {
    const fd = new FormData();
    fd.append('file', new File([new Uint8Array([...bytes, ...new Array(64).fill(0)])], 'a.bin'));
    return call(`/api/intake/${token}/upload`, { method: 'POST', admin: false, body: fd, headers: header ? { 'x-requested-with': 'dyflorist' } : {} });
  };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  assert.equal((await send('a'.repeat(48), png)).status, 404); // token asing
  const { token } = await (await post(cookie, `/api/admin/invitations/${id}/intake`, { action: 'open' })).json() as any;
  assert.equal((await send(token, png, false)).status, 403);
  assert.equal((await send(token, png)).status, 200);
  assert.equal((await send(token, [0x49, 0x44, 0x33, 0x04])).status, 415); // MP3 bukan untuk pelanggan
  assert.equal((await send(token, [0x3c, 0x73, 0x76, 0x67])).status, 415);
  await post(cookie, `/api/admin/invitations/${id}/intake`, { action: 'close' });
  assert.equal((await send(token, png)).status, 404);
});

test('masa aktif: diarsipkan otomatis setelah acara + N hari, tidak bisa diterbitkan bila sudah lewat', async () => {
  const cookie = await loginUndangan();
  const id = await createInvitation(cookie, 'masa-aktif-uji');
  const past = { ...FILLED, events: [{ title: 'Akad', startIso: '2026-10-01T08:00:00+07:00', endIso: '2026-10-01T10:00:00+07:00' }] };
  // acara 1 Okt 2026 + 30 hari = 31 Okt 2026 (sudah lewat); tapi masih draft boleh disimpan
  const save = (days: number, data: unknown = past) => call(`/api/admin/invitations/${id}`, {
    method: 'PUT', cookie, ...json({ slug: 'masa-aktif-uji', customerName: '', customerPhone: '', note: '', retentionDays: days, data }),
  });
  assert.equal((await save(30)).status, 200);
  assert.equal((await post(cookie, `/api/admin/invitations/${id}/status`, { status: 'terbit' })).status, 422); // sudah lewat
  assert.equal((await save(0)).status, 200); // 0 = tidak otomatis
  assert.equal((await post(cookie, `/api/admin/invitations/${id}/status`, { status: 'terbit' })).status, 200);
  assert.equal((await call('/api/invitations/masa-aktif-uji')).status, 200);
  assert.equal((await save(365)).status, 200);
  const d = await (await call(`/api/admin/invitations/${id}`, { cookie })).json() as any;
  assert.equal(d.retentionDays, 365);
  assert.ok(d.expiresAt && new Date(d.expiresAt).getFullYear() === 2027);

  // Diubah menjadi 30 hari lewat database (seolah masa aktif habis saat tamu membuka link)
  await getDb().update(schema.invitations).set({ retentionDays: 30 }).where((await import('drizzle-orm')).eq(schema.invitations.id, id));
  assert.equal((await call('/api/invitations/masa-aktif-uji')).status, 410);
  assert.equal((await wish('masa-aktif-uji', { name: 'A', message: 'B', attendance: 'hadir' })).status, 410);
  const list = await (await call('/api/admin/invitations', { cookie })).json() as any[];
  assert.equal(list.find((r) => r.id === id).status, 'arsip');
  assert.equal((await save(7 as any)).status, 422); // pilihan di luar daftar ditolak
});

test('error server tidak membocorkan detail & body rusak ditolak', async () => {
  const res = await call('/api/orders', { method: 'POST', admin: false, body: '{bukan json', headers: { 'content-type': 'application/json' } });
  assert.ok([422, 400].includes(res.status));
  const text = await res.text();
  assert.ok(!/stack|at .*\.ts|mysql|drizzle/i.test(text));
});
