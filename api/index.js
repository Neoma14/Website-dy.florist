var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/lib/mailer.ts
var ALERT_EMAIL = process.env.ALERT_EMAIL || "dyfloristparcel@gmail.com";
var SITE_URL = (process.env.SITE_URL || "https://www.dyflorist.site").replace(/\/+$/, "");
var escHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function recoveryUrl(token) {
  return `${SITE_URL}/admin?pemulihan=${token}`;
}
async function sendBlockedAlert(info) {
  const link = recoveryUrl(info.token);
  const when = (/* @__PURE__ */ new Date()).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "short" }) + " WIB";
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(`[KEAMANAN] Login admin diblokir (${info.ip}). RESEND_API_KEY belum diatur, email tidak terkirim. Link pemulihan (24 jam): ${link}`);
    return false;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2b2227">
  <h2 style="color:#E4007F;margin-bottom:4px">dy.florist</h2>
  <h3 style="margin-top:0">Login admin diblokir</h3>
  <p>Ada percobaan login ke halaman admin dengan password salah berulang kali. Setelah dikunci 5 menit, percobaan itu masih salah, sehingga login dari perangkat tersebut <strong>diblokir</strong>.</p>
  <table style="font-size:14px;margin:12px 0">
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Waktu</td><td>${escHtml(when)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Alamat IP</td><td>${escHtml(info.ip)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6c6267">Perangkat</td><td>${escHtml(info.userAgent.slice(0, 160))}</td></tr>
  </table>
  <p>Jika itu Anda, buka blokir dengan tombol di bawah (berlaku 24 jam, sekali pakai):</p>
  <p><a href="${link}" style="display:inline-block;background:#E4007F;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Buka Blokir Login Admin</a></p>
  <p style="font-size:13px;color:#6c6267">Jika bukan Anda, jangan klik tombol di atas. Blokir tetap aktif dan password Anda aman. Pertimbangkan mengganti password admin.</p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "dy.florist Keamanan <onboarding@resend.dev>",
        to: [ALERT_EMAIL],
        subject: "Peringatan: login admin dy.florist diblokir",
        html
      })
    });
    if (!res.ok) {
      console.error(`[KEAMANAN] Email pemulihan gagal (${res.status}). Link pemulihan (24 jam): ${link}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[KEAMANAN] Email pemulihan gagal: ${e instanceof Error ? e.message : e}. Link pemulihan (24 jam): ${link}`);
    return false;
  }
}

// server/app.ts
import { Elysia, t } from "elysia";
import { randomBytes as randomBytes3, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and as and2, asc, desc, eq as eq2, inArray, ne, sql as sql2 } from "drizzle-orm";

// server/db/index.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bespokePrices: () => bespokePrices,
  categories: () => categories,
  loginAttempts: () => loginAttempts,
  loginBlocks: () => loginBlocks,
  orderItems: () => orderItems,
  orders: () => orders,
  products: () => products,
  rateEvents: () => rateEvents,
  recoveryTokens: () => recoveryTokens,
  sessions: () => sessions
});
import { mysqlTable, varchar, int, text, timestamp, datetime, index } from "drizzle-orm/mysql-core";
var categories = mysqlTable("categories", {
  key: varchar("key", { length: 30 }).primaryKey(),
  name: varchar("name", { length: 40 }).notNull(),
  emoji: varchar("emoji", { length: 16 }).notNull().default(""),
  sort: int("sort").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var bespokePrices = mysqlTable("bespoke_prices", {
  key: varchar("key", { length: 40 }).primaryKey(),
  kind: varchar("kind", { length: 10 }).notNull(),
  // 'type' | 'addon'
  label: varchar("label", { length: 60 }).notNull(),
  price: int("price"),
  // null = harga via konsultasi (khusus jenis produk)
  sort: int("sort").notNull().default(0)
});
var products = mysqlTable("products", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  categoryName: varchar("category_name", { length: 40 }).notNull(),
  price: int("price").notNull(),
  // Harga coret (harga normal sebelum diskon); null = tidak ada diskon
  originalPrice: int("original_price"),
  badge: varchar("badge", { length: 40 }).notNull().default(""),
  description: text("description").notNull(),
  image: varchar("image", { length: 500 }).notNull(),
  rating: int("rating_x10").notNull().default(50),
  reviews: int("reviews").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  recipient: varchar("recipient", { length: 120 }).notNull(),
  scheduled: varchar("scheduled", { length: 120 }).notNull(),
  note: varchar("note", { length: 500 }).notNull().default(""),
  total: int("total").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  productId: varchar("product_id", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  price: int("price").notNull(),
  qty: int("qty").notNull()
}, (t2) => [index("order_items_order_idx").on(t2.orderId)]);
var sessions = mysqlTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  expiresAt: datetime("expires_at").notNull()
});
var loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (t2) => [index("login_attempts_ip_idx").on(t2.ipHash, t2.createdAt)]);
var loginBlocks = mysqlTable("login_blocks", {
  ipHash: varchar("ip_hash", { length: 64 }).primaryKey(),
  level: int("level").notNull(),
  lockedUntil: datetime("locked_until"),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var recoveryTokens = mysqlTable("recovery_tokens", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  expiresAt: datetime("expires_at").notNull(),
  usedAt: datetime("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
var rateEvents = mysqlTable("rate_events", {
  id: int("id").autoincrement().primaryKey(),
  bucket: varchar("bucket", { length: 40 }).notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (t2) => [index("rate_events_idx").on(t2.bucket, t2.ipHash, t2.createdAt)]);

// server/db/index.ts
var pool;
function getDb() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL belum diatur");
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 3,
      charset: "utf8mb4",
      // agar emoji (mis. pada kategori) tersimpan dengan benar
      ssl: process.env.DATABASE_SSL === "false" ? void 0 : { minVersion: "TLSv1.2", rejectUnauthorized: true }
    });
  }
  return drizzle(pool, { schema: schema_exports, mode: "default" });
}

// server/lib/password.ts
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
var N = 2 ** 15;
var KEYLEN = 64;
function derive(password, salt, n, r, p) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) => err ? reject(err) : resolve(key));
  });
}
function describeHash(stored) {
  if (!stored) return "kosong/tidak diatur";
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== "scrypt") return `format salah (${parts.length} bagian, harus 6)`;
  return "format benar";
}
async function verifyPassword(password, stored) {
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await derive(password, Buffer.from(saltHex, "hex"), +n, +r, +p);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// server/lib/security.ts
import { createHash, randomBytes as randomBytes2 } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
var SESSION_COOKIE = "dyf_session";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var sha256 = (s) => createHash("sha256").update(s).digest("hex");
function hashIp(ip) {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("APP_SECRET belum diatur (min 32 karakter)");
  return sha256(secret + ":" + ip);
}
function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
}
async function createSession() {
  const db = getDb();
  const token = randomBytes2(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema_exports.sessions).values({ tokenHash: sha256(token), expiresAt: expires });
  await db.delete(schema_exports.sessions).where(lt(schema_exports.sessions.expiresAt, /* @__PURE__ */ new Date()));
  return { token, expires };
}
async function isValidSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const rows = await getDb().select().from(schema_exports.sessions).where(and(eq(schema_exports.sessions.tokenHash, sha256(token)), gt(schema_exports.sessions.expiresAt, /* @__PURE__ */ new Date()))).limit(1);
  return rows.length === 1;
}
async function destroySession(token) {
  if (!token) return;
  await getDb().delete(schema_exports.sessions).where(eq(schema_exports.sessions.tokenHash, sha256(token)));
}
var LOGIN_WINDOW_MS = 15 * 60 * 1e3;
var LOGIN_MAX_PER_IP = 3;
var LOCK_MS = 5 * 60 * 1e3;
var LOGIN_MAX_GLOBAL = 100;
var LEVEL1_FORGET_MS = 24 * 60 * 60 * 1e3;
async function loginGate(ipHash) {
  const db = getDb();
  const [row] = await db.select().from(schema_exports.loginBlocks).where(eq(schema_exports.loginBlocks.ipHash, ipHash)).limit(1);
  if (row?.level === 2) return { state: "blocked" };
  if (row?.level === 1 && row.lockedUntil) {
    const until = new Date(row.lockedUntil).getTime();
    if (until > Date.now()) return { state: "locked", retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1e3)) };
    if (until < Date.now() - LEVEL1_FORGET_MS) await db.delete(schema_exports.loginBlocks).where(eq(schema_exports.loginBlocks.ipHash, ipHash));
  }
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [global] = await db.select({ n: sql`count(*)`, first: sql`min(created_at)` }).from(schema_exports.loginAttempts).where(gt(schema_exports.loginAttempts.createdAt, since));
  if (Number(global.n) >= LOGIN_MAX_GLOBAL) {
    const until = new Date(global.first).getTime() + LOGIN_WINDOW_MS;
    return { state: "locked", retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1e3)) };
  }
  return { state: "ok" };
}
async function registerFailedLogin(ipHash) {
  const db = getDb();
  await db.insert(schema_exports.loginAttempts).values({ ipHash });
  await db.delete(schema_exports.loginAttempts).where(lt(schema_exports.loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1e3)));
  const [row] = await db.select().from(schema_exports.loginBlocks).where(eq(schema_exports.loginBlocks.ipHash, ipHash)).limit(1);
  if (row?.level === 1) {
    await db.update(schema_exports.loginBlocks).set({ level: 2, lockedUntil: null, updatedAt: /* @__PURE__ */ new Date() }).where(eq(schema_exports.loginBlocks.ipHash, ipHash));
    return { state: "blocked" };
  }
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [perIp] = await db.select({ n: sql`count(*)` }).from(schema_exports.loginAttempts).where(and(eq(schema_exports.loginAttempts.ipHash, ipHash), gt(schema_exports.loginAttempts.createdAt, since)));
  const n = Number(perIp.n);
  if (n >= LOGIN_MAX_PER_IP) {
    const lockedUntil = new Date(Date.now() + LOCK_MS);
    await db.insert(schema_exports.loginBlocks).values({ ipHash, level: 1, lockedUntil }).onDuplicateKeyUpdate({ set: { level: 1, lockedUntil, updatedAt: /* @__PURE__ */ new Date() } });
    return { state: "locked", retryAfter: Math.ceil(LOCK_MS / 1e3) };
  }
  return { state: "wrong", remaining: LOGIN_MAX_PER_IP - n };
}
async function clearFailedLogins(ipHash) {
  const db = getDb();
  await db.delete(schema_exports.loginAttempts).where(eq(schema_exports.loginAttempts.ipHash, ipHash));
  await db.delete(schema_exports.loginBlocks).where(eq(schema_exports.loginBlocks.ipHash, ipHash));
}
var RECOVERY_TTL_MS = 24 * 60 * 60 * 1e3;
async function createRecoveryToken() {
  const token = randomBytes2(32).toString("hex");
  const db = getDb();
  await db.insert(schema_exports.recoveryTokens).values({ tokenHash: sha256(token), expiresAt: new Date(Date.now() + RECOVERY_TTL_MS) });
  await db.delete(schema_exports.recoveryTokens).where(lt(schema_exports.recoveryTokens.expiresAt, new Date(Date.now() - RECOVERY_TTL_MS)));
  return token;
}
async function useRecoveryToken(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const db = getDb();
  const hash = sha256(token);
  const [row] = await db.select().from(schema_exports.recoveryTokens).where(eq(schema_exports.recoveryTokens.tokenHash, hash)).limit(1);
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return false;
  await db.update(schema_exports.recoveryTokens).set({ usedAt: /* @__PURE__ */ new Date() }).where(eq(schema_exports.recoveryTokens.tokenHash, hash));
  await db.delete(schema_exports.loginBlocks);
  await db.delete(schema_exports.loginAttempts);
  return true;
}
async function rateLimited(bucket, ipHash, max, windowMs) {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const [row] = await db.select({ n: sql`count(*)` }).from(schema_exports.rateEvents).where(and(
    eq(schema_exports.rateEvents.bucket, bucket),
    eq(schema_exports.rateEvents.ipHash, ipHash),
    gt(schema_exports.rateEvents.createdAt, since)
  ));
  if (Number(row.n) >= max) return true;
  await db.insert(schema_exports.rateEvents).values({ bucket, ipHash });
  await db.delete(schema_exports.rateEvents).where(lt(schema_exports.rateEvents.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1e3)));
  return false;
}
function detectImageType(buf) {
  if (buf.length > 12) {
    if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return "jpg";
    if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) return "png";
    if (buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80) return "webp";
  }
  return null;
}

// server/app.ts
var MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
var UPLOAD_DIR = join(process.cwd(), ".uploads");
var blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
var isProd = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL;
var IMAGE_PATTERNS = [
  /^\/assets\/[\w.-]+$/,
  /^\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/,
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/products\/[\w.-]+$/
];
async function getCategoryName(key) {
  const [row] = await getDb().select({ name: schema_exports.categories.name }).from(schema_exports.categories).where(eq2(schema_exports.categories.key, key)).limit(1);
  return row?.name ?? null;
}
function slugify(name) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return slug || "kategori";
}
var cleanText = (v) => v.replace(/[\u0000-\u001f\u007f<>]/g, "").trim();
var isAllowedImage = (s) => IMAGE_PATTERNS.some((re) => re.test(s));
var normalizeOriginalPrice = (price, original) => original && original > price ? original : null;
var text2 = (min, max) => t.String({ minLength: min, maxLength: max });
var productBody = t.Object({
  name: text2(1, 120),
  category: t.String({ minLength: 1, maxLength: 30, pattern: "^[a-z0-9_]+$" }),
  price: t.Integer({ minimum: 0, maximum: 1e8 }),
  originalPrice: t.Optional(t.Union([t.Integer({ minimum: 0, maximum: 1e8 }), t.Null()])),
  badge: text2(0, 40),
  description: text2(1, 1e3),
  image: text2(1, 500)
});
function getCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return void 0;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return void 0;
}
function allowedOrigins() {
  const list = (process.env.ALLOWED_ORIGIN ?? "").split(",").map((s) => s.replace(/[^\x21-\x7e]/g, "").replace(/\/+$/, "")).filter(Boolean);
  if (process.env.VERCEL_ENV === "preview") {
    for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
      if (host) list.push(`https://${host}`);
    }
  }
  return list;
}
function csrfOk(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("x-requested-with") !== "dyflorist") return false;
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].replace(/[^\x21-\x7e]/g, "");
  const sameOrigin = !!origin && !!host && origin === `https://${host}`;
  const ok = !!origin && (sameOrigin || allowed.includes(origin));
  if (!ok) {
    console.error(
      `CSRF ditolak: origin="${origin ?? ""}" tidak ada di ALLOWED_ORIGIN (terdaftar: ${allowed.length}, panjang: [${allowed.map((a) => a.length).join(",")}], mentah: ${(process.env.ALLOWED_ORIGIN ?? "").length} karakter, env: ${process.env.VERCEL_ENV ?? "lokal"})`
    );
  }
  return ok;
}
function sessionCookie(value, expires) {
  const attrs = [`${SESSION_COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Strict"];
  if (isProd()) attrs.push("Secure");
  if (expires) {
    attrs.push(`Expires=${expires.toUTCString()}`, `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`);
  } else {
    attrs.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT", "Max-Age=0");
  }
  return attrs.join("; ");
}
async function storeImage(buf, ext, contentType) {
  const name = randomBytes3(16).toString("hex");
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`products/${name}.${ext}`, Buffer.from(buf), {
      access: "public",
      contentType,
      addRandomSuffix: false
    });
    return blob.url;
  }
  if (isProd()) throw new Error("Penyimpanan foto belum dikonfigurasi");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, `${name}.${ext}`), buf);
  return `/api/uploads/${name}.${ext}`;
}
async function removeImage(url) {
  if (!url.includes(".public.blob.vercel-storage.com/") || !blobConfigured()) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(url);
  } catch {
  }
}
var toPublic = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  categoryName: p.categoryName,
  price: p.price,
  originalPrice: p.originalPrice ?? null,
  badge: p.badge,
  description: p.description,
  image: p.image,
  rating: p.rating / 10,
  reviews: p.reviews
});
var BLOCKED_MSG = "Login dari perangkat ini diblokir karena password salah berulang kali. Link pemulihan sudah dikirim ke email dy.florist.";
var denied = (status, error) => new Response(JSON.stringify({ error }), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
var app = new Elysia({ prefix: "/api" }).onRequest(async ({ request }) => {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/admin")) return;
  if (!csrfOk(request)) return denied(403, "Permintaan ditolak");
  if (path === "/api/admin/login" || path === "/api/admin/recover") return;
  if (!await isValidSession(getCookie(request, SESSION_COOKIE))) return denied(401, "Belum login");
}).onAfterHandle({ as: "global" }, ({ set }) => {
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["x-frame-options"] = "DENY";
  set.headers["referrer-policy"] = "no-referrer";
  set.headers["cache-control"] ??= "no-store";
}).onError({ as: "global" }, ({ code, set, error }) => {
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["cache-control"] = "no-store";
  if (code === "VALIDATION" || code === "PARSE") {
    set.status = 422;
    return { error: "Data tidak valid" };
  }
  if (code === "NOT_FOUND") {
    set.status = 404;
    return { error: "Tidak ditemukan" };
  }
  console.error("API error:", error instanceof Error ? error.message : error);
  set.status = 500;
  return { error: "Terjadi kesalahan server" };
}).get("/health", () => ({ ok: true })).get("/products", async () => {
  const rows = await getDb().select().from(schema_exports.products).orderBy(desc(schema_exports.products.createdAt), desc(schema_exports.products.id));
  return rows.map(toPublic);
}).get("/categories", async () => {
  const rows = await getDb().select().from(schema_exports.categories).orderBy(asc(schema_exports.categories.sort), asc(schema_exports.categories.key));
  return rows.map((c) => ({ key: c.key, name: c.name, emoji: c.emoji }));
}).get("/share/:id", async ({ params }) => {
  const html = (body, status = 200) => new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff"
    }
  });
  const id = params.id;
  const [p] = /^[\w-]{1,40}$/.test(id) ? await getDb().select().from(schema_exports.products).where(eq2(schema_exports.products.id, id)).limit(1) : [];
  if (!p) {
    return html('<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/katalog"><title>dy.florist</title></head><body><a href="/katalog">Lihat katalog dy.florist</a></body></html>', 404);
  }
  const e = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const image = p.image.startsWith("/") ? SITE_URL + p.image : p.image;
  const price = "Rp " + p.price.toLocaleString("id-ID");
  const target = `/katalog?produk=${encodeURIComponent(p.id)}`;
  const title = `${p.name} \u2014 ${price}`;
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
<meta property="og:url" content="${e(SITE_URL + "/produk/" + p.id)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${e(SITE_URL + target)}">
<meta http-equiv="refresh" content="0; url=${e(target)}">
</head><body><p><a href="${e(target)}">${e(p.name)}</a></p></body></html>`);
}).get("/bespoke-prices", async () => {
  const rows = await getDb().select().from(schema_exports.bespokePrices).orderBy(asc(schema_exports.bespokePrices.sort));
  return rows.map((r) => ({ key: r.key, kind: r.kind, label: r.label, price: r.price }));
}).get("/uploads/:name", async ({ params, set }) => {
  if (isProd() || !/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(params.name)) {
    set.status = 404;
    return { error: "Tidak ditemukan" };
  }
  try {
    const data = await readFile(join(UPLOAD_DIR, params.name));
    const ext = params.name.split(".")[1];
    set.headers["content-type"] = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    set.headers["cache-control"] = "public, max-age=31536000, immutable";
    return new Response(data, { headers: set.headers });
  } catch {
    set.status = 404;
    return { error: "Tidak ditemukan" };
  }
}).post("/orders", async ({ body, request, set }) => {
  const ipHash = hashIp(clientIp(request));
  if (await rateLimited("order", ipHash, 5, 10 * 60 * 1e3)) {
    set.status = 429;
    set.headers["retry-after"] = "600";
    return { error: "Terlalu banyak pesanan. Coba lagi nanti." };
  }
  if (await rateLimited("order-global", "all", 200, 60 * 60 * 1e3)) {
    set.status = 429;
    set.headers["retry-after"] = "600";
    return { error: "Layanan sedang sibuk. Silakan hubungi kami lewat WhatsApp." };
  }
  const db = getDb();
  const ids = [...new Set(body.items.map((i) => i.id))];
  const found = await db.select().from(schema_exports.products).where(inArray(schema_exports.products.id, ids));
  if (found.length !== ids.length) {
    set.status = 400;
    return { error: "Ada produk yang tidak tersedia" };
  }
  const byId = new Map(found.map((p) => [p.id, p]));
  const lines = body.items.map((i) => {
    const p = byId.get(i.id);
    return { productId: p.id, name: p.name, price: p.price, qty: i.qty };
  });
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const orderId = await db.transaction(async (tx) => {
    const [res] = await tx.insert(schema_exports.orders).values({
      recipient: body.recipient,
      scheduled: body.scheduled,
      note: body.note,
      total
    });
    const id = Number(res.insertId);
    await tx.insert(schema_exports.orderItems).values(lines.map((l) => ({ ...l, orderId: id })));
    return id;
  });
  return { id: orderId, total };
}, {
  body: t.Object({
    recipient: text2(1, 120),
    scheduled: text2(1, 120),
    note: text2(0, 500),
    items: t.Array(
      t.Object({ id: text2(1, 40), qty: t.Integer({ minimum: 1, maximum: 50 }) }),
      { minItems: 1, maxItems: 30 }
    )
  })
}).post("/admin/login", async ({ body, request, set }) => {
  const ip = clientIp(request);
  const ipHash = hashIp(ip);
  const gate = await loginGate(ipHash);
  if (gate.state === "blocked") {
    set.status = 403;
    return { error: BLOCKED_MSG, blocked: true };
  }
  if (gate.state === "locked") {
    set.status = 429;
    set.headers["retry-after"] = String(gate.retryAfter);
    return { error: `Login dikunci. Coba lagi dalam ${Math.ceil(gate.retryAfter / 60)} menit.` };
  }
  const stored = process.env.ADMIN_PASSWORD_HASH ?? "";
  const ok = stored ? await verifyPassword(body.password, stored) : false;
  if (!ok) {
    if (describeHash(stored) !== "format benar") {
      console.error("Login admin gagal: ADMIN_PASSWORD_HASH " + describeHash(stored));
    }
    const fail = await registerFailedLogin(ipHash);
    if (fail.state === "blocked") {
      if (!await rateLimited("recovery_email", "global", 3, 60 * 60 * 1e3)) {
        const token2 = await createRecoveryToken();
        await sendBlockedAlert({ token: token2, ip, userAgent: request.headers.get("user-agent") ?? "-" });
      }
      set.status = 403;
      return { error: BLOCKED_MSG, blocked: true };
    }
    if (fail.state === "locked") {
      set.status = 429;
      set.headers["retry-after"] = String(fail.retryAfter);
      return { error: `3x password salah. Login dikunci ${LOCK_MS / 6e4} menit.` };
    }
    set.status = 401;
    return { error: `Password salah. Sisa ${fail.remaining} percobaan sebelum dikunci ${LOCK_MS / 6e4} menit.` };
  }
  await clearFailedLogins(ipHash);
  const { token, expires } = await createSession();
  set.headers["set-cookie"] = sessionCookie(token, expires);
  return { ok: true };
}, { body: t.Object({ password: text2(1, 200) }) }).post("/admin/recover", async ({ body, request, set }) => {
  const ipHash = hashIp(clientIp(request));
  if (await rateLimited("recover", ipHash, 10, 15 * 60 * 1e3)) {
    set.status = 429;
    return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
  }
  if (!await useRecoveryToken(body.token)) {
    set.status = 400;
    return { error: "Link pemulihan tidak valid, sudah dipakai, atau kedaluwarsa." };
  }
  return { ok: true };
}, { body: t.Object({ token: text2(1, 100) }) }).group(
  "/admin",
  (admin) => admin.get("/session", () => ({ ok: true })).post("/logout", async ({ request, set }) => {
    await destroySession(getCookie(request, SESSION_COOKIE));
    set.headers["set-cookie"] = sessionCookie("", null);
    return { ok: true };
  }).post("/categories", async ({ body, set }) => {
    const db = getDb();
    const name = cleanText(body.name);
    const emoji = cleanText(body.emoji);
    if (!name) {
      set.status = 422;
      return { error: "Nama kategori wajib diisi" };
    }
    const all = await db.select().from(schema_exports.categories);
    if (all.length >= 30) {
      set.status = 409;
      return { error: "Jumlah kategori sudah mencapai batas (30)" };
    }
    if (all.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      set.status = 409;
      return { error: "Nama kategori sudah ada" };
    }
    const base = slugify(name);
    let key = base;
    for (let i = 2; all.some((c) => c.key === key); i++) key = `${base.slice(0, 26)}_${i}`;
    const sort = all.reduce((m, c) => Math.max(m, c.sort), 0) + 1;
    await db.insert(schema_exports.categories).values({ key, name, emoji, sort });
    return { key };
  }, { body: t.Object({ name: text2(1, 40), emoji: text2(0, 16) }) }).put("/categories/:key", async ({ params, body, set }) => {
    const db = getDb();
    const name = cleanText(body.name);
    const emoji = cleanText(body.emoji);
    if (!name) {
      set.status = 422;
      return { error: "Nama kategori wajib diisi" };
    }
    const [row] = await db.select().from(schema_exports.categories).where(eq2(schema_exports.categories.key, params.key)).limit(1);
    if (!row) {
      set.status = 404;
      return { error: "Kategori tidak ditemukan" };
    }
    const dupe = await db.select({ key: schema_exports.categories.key }).from(schema_exports.categories).where(and2(sql2`lower(${schema_exports.categories.name}) = ${name.toLowerCase()}`, ne(schema_exports.categories.key, params.key)));
    if (dupe.length > 0) {
      set.status = 409;
      return { error: "Nama kategori sudah ada" };
    }
    await db.update(schema_exports.categories).set({ name, emoji }).where(eq2(schema_exports.categories.key, params.key));
    await db.update(schema_exports.products).set({ categoryName: name }).where(eq2(schema_exports.products.category, params.key));
    return { ok: true };
  }, { body: t.Object({ name: text2(1, 40), emoji: text2(0, 16) }) }).delete("/categories/:key", async ({ params, set }) => {
    const db = getDb();
    const [row] = await db.select().from(schema_exports.categories).where(eq2(schema_exports.categories.key, params.key)).limit(1);
    if (!row) {
      set.status = 404;
      return { error: "Kategori tidak ditemukan" };
    }
    const [used] = await db.select({ n: sql2`count(*)` }).from(schema_exports.products).where(eq2(schema_exports.products.category, params.key));
    if (Number(used.n) > 0) {
      set.status = 409;
      return { error: `Masih ada ${Number(used.n)} produk di kategori ini. Pindahkan atau hapus produknya dulu.` };
    }
    await db.delete(schema_exports.categories).where(eq2(schema_exports.categories.key, params.key));
    return { ok: true };
  }).post("/products", async ({ body, set }) => {
    if (!isAllowedImage(body.image)) {
      set.status = 422;
      return { error: "Foto tidak valid" };
    }
    const categoryName = await getCategoryName(body.category);
    if (!categoryName) {
      set.status = 422;
      return { error: "Kategori tidak ditemukan" };
    }
    const id = "prod_" + randomUUID().replace(/-/g, "").slice(0, 16);
    await getDb().insert(schema_exports.products).values({
      id,
      ...body,
      originalPrice: normalizeOriginalPrice(body.price, body.originalPrice),
      categoryName,
      rating: 50,
      reviews: 1,
      badge: body.badge || "New Arrival"
    });
    return { id };
  }, { body: productBody }).put("/products/:id", async ({ params, body, set }) => {
    if (!isAllowedImage(body.image)) {
      set.status = 422;
      return { error: "Foto tidak valid" };
    }
    const db = getDb();
    const [old] = await db.select().from(schema_exports.products).where(eq2(schema_exports.products.id, params.id)).limit(1);
    if (!old) {
      set.status = 404;
      return { error: "Produk tidak ditemukan" };
    }
    const categoryName = await getCategoryName(body.category);
    if (!categoryName) {
      set.status = 422;
      return { error: "Kategori tidak ditemukan" };
    }
    await db.update(schema_exports.products).set({ ...body, originalPrice: normalizeOriginalPrice(body.price, body.originalPrice), categoryName }).where(eq2(schema_exports.products.id, params.id));
    if (old.image !== body.image) await removeImage(old.image);
    return { ok: true };
  }, { body: productBody }).delete("/products/:id", async ({ params, set }) => {
    const db = getDb();
    const [old] = await db.select().from(schema_exports.products).where(eq2(schema_exports.products.id, params.id)).limit(1);
    if (!old) {
      set.status = 404;
      return { error: "Produk tidak ditemukan" };
    }
    await db.delete(schema_exports.products).where(eq2(schema_exports.products.id, params.id));
    await removeImage(old.image);
    return { ok: true };
  }).post("/upload", async ({ body, set }) => {
    const file = body.file;
    if (file.size > MAX_UPLOAD_BYTES) {
      set.status = 413;
      return { error: "Foto terlalu besar (maks 4 MB)" };
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(buf);
    if (!type) {
      set.status = 415;
      return { error: "Hanya JPG, PNG, atau WebP" };
    }
    const contentType = type === "png" ? "image/png" : type === "webp" ? "image/webp" : "image/jpeg";
    return { url: await storeImage(buf, type, contentType) };
  }, { body: t.Object({ file: t.File() }) }).put("/bespoke-prices", async ({ body, set }) => {
    const db = getDb();
    const rows = await db.select().from(schema_exports.bespokePrices);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const item of body.items) {
      const row = byKey.get(item.key);
      if (!row) {
        set.status = 422;
        return { error: "Data harga tidak dikenal" };
      }
      if (row.kind === "addon" && item.price === null) {
        set.status = 422;
        return { error: `Harga ${row.label} wajib diisi` };
      }
    }
    for (const item of body.items) {
      await db.update(schema_exports.bespokePrices).set({ price: item.price }).where(eq2(schema_exports.bespokePrices.key, item.key));
    }
    return { ok: true };
  }, {
    body: t.Object({
      items: t.Array(t.Object({
        key: t.String({ minLength: 1, maxLength: 40, pattern: "^[a-z0-9_]+$" }),
        price: t.Union([t.Integer({ minimum: 0, maximum: 1e8 }), t.Null()])
      }), { minItems: 1, maxItems: 50 })
    })
  }).get("/orders", async () => {
    const db = getDb();
    const orders2 = await db.select().from(schema_exports.orders).orderBy(desc(schema_exports.orders.createdAt)).limit(500);
    const items = orders2.length ? await db.select().from(schema_exports.orderItems).where(inArray(schema_exports.orderItems.orderId, orders2.map((o) => o.id))) : [];
    return orders2.map((o) => ({
      id: o.id,
      recipient: o.recipient,
      scheduled: o.scheduled,
      note: o.note,
      total: o.total,
      createdAt: o.createdAt,
      items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, qty: i.qty, price: i.price }))
    }));
  }).delete("/orders", async () => {
    const db = getDb();
    await db.delete(schema_exports.orderItems);
    await db.delete(schema_exports.orders);
    return { ok: true };
  })
);
var app_default = app;

// server/handler.ts
var handler_default = {
  fetch: (request) => {
    const url = new URL(request.url);
    const m = /^\/produk\/([\w-]{1,40})\/?$/.exec(url.pathname);
    if (m) return app_default.fetch(new Request(`${url.origin}/api/share/${m[1]}`, { method: request.method, headers: request.headers }));
    return app_default.fetch(request);
  }
};
export {
  handler_default as default
};
