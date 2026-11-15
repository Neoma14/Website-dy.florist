import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from './lib/password';

const PASSWORD = 'correct-horse-battery-staple';
const ORIGIN = 'http://localhost:5173';
process.env.ALLOWED_ORIGIN = ORIGIN;
process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD);
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

before(async () => {
  const db = getDb();
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
  assert.match(html, new RegExp(`url=/katalog\\?produk=${id}`));
  // /produk/:id lewat handler Vercel diarahkan ke halaman yang sama
  const { default: handler } = await import('./handler');
  const viaHandler = await handler.fetch(new Request(`http://localhost/produk/${id}`, { headers: { 'x-forwarded-for': newIp() } }));
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

test('error server tidak membocorkan detail & body rusak ditolak', async () => {
  const res = await call('/api/orders', { method: 'POST', admin: false, body: '{bukan json', headers: { 'content-type': 'application/json' } });
  assert.ok([422, 400].includes(res.status));
  const text = await res.text();
  assert.ok(!/stack|at .*\.ts|mysql|drizzle/i.test(text));
});
