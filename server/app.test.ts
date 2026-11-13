import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from './lib/password';

const PASSWORD = 'correct-horse-battery-staple';
const ORIGIN = 'http://localhost:5173';
process.env.ALLOWED_ORIGIN = ORIGIN;
process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD);
delete process.env.BLOB_READ_WRITE_TOKEN;

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

test('pemblokiran: 5x salah memblokir IP itu, bahkan dengan password benar', async () => {
  const ip = newIp();
  for (let i = 0; i < 5; i++) {
    const r = await call('/api/admin/login', { method: 'POST', ip, ...json({ password: 'salah' + i }) });
    assert.equal(r.status, 401);
  }
  const blocked = await call('/api/admin/login', { method: 'POST', ip, ...json({ password: PASSWORD }) });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  // IP lain tidak terblokir
  const other = await call('/api/admin/login', { method: 'POST', ip: newIp(), ...json({ password: PASSWORD }) });
  assert.equal(other.status, 200);
  await getDb().delete(schema.loginAttempts);
});

test('request admin yang mengubah data tanpa CSRF header ditolak walau sudah login', async () => {
  const cookie = await login();
  const res = await call('/api/admin/products', { method: 'POST', admin: false, cookie, ...json({}) });
  assert.equal(res.status, 403);
});

test('produk: gambar javascript:/URL luar ditolak, data tidak valid 422', async () => {
  const cookie = await login();
  const base = { name: 'Tes', category: 'florist', price: 1000, badge: '', description: 'x' };
  for (const image of ['javascript:alert(1)', 'https://evil.example/x.jpg', 'data:text/html,<script>', '../etc/passwd']) {
    const res = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...base, image }) });
    assert.equal(res.status, 422, image);
  }
  const bad = await call('/api/admin/products', { method: 'POST', cookie, ...json({ ...base, price: -5, image: '/assets/logo.png' }) });
  assert.equal(bad.status, 422);
});

test('produk: tambah, ubah, hapus oleh admin', async () => {
  const cookie = await login();
  const body = { name: '<img src=x onerror=alert(1)>', category: 'gift', price: 12345, badge: '', description: 'desc', image: '/assets/logo.png' };
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
  assert.equal((await mk([{ id: 'f1', qty: 0 }])).status, 422);
  assert.equal((await mk([{ id: 'f1', qty: 9999 }])).status, 422);
  assert.equal((await mk([])).status, 422);
  assert.equal((await mk([{ id: 'f1', qty: 1 }], { note: 'x'.repeat(501) })).status, 422);
});

test('pesanan: rate limit per IP (maks 5 / 10 menit)', async () => {
  const ip = newIp();
  const send = () => call('/api/orders', {
    method: 'POST', admin: false, ip,
    ...json({ recipient: 'A', scheduled: 'B', note: '', items: [{ id: 'f1', qty: 1 }] }),
  });
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
});

test('pesanan: payload XSS disimpan apa adanya tapi hanya admin yang bisa membaca daftar', async () => {
  const xss = '<script>alert(1)</script>';
  const o = await call('/api/orders', {
    method: 'POST', admin: false,
    ...json({ recipient: xss, scheduled: 'x', note: xss, items: [{ id: 'f1', qty: 1 }] }),
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
