var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/app.ts
import { Elysia, t } from "elysia";
import { randomBytes as randomBytes3, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { desc, eq as eq2, inArray } from "drizzle-orm";

// server/db/index.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// server/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  loginAttempts: () => loginAttempts,
  orderItems: () => orderItems,
  orders: () => orders,
  products: () => products,
  rateEvents: () => rateEvents,
  sessions: () => sessions
});
import { mysqlTable, varchar, int, text, timestamp, datetime, index } from "drizzle-orm/mysql-core";
var products = mysqlTable("products", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(),
  categoryName: varchar("category_name", { length: 40 }).notNull(),
  price: int("price").notNull(),
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
var LOGIN_MAX_PER_IP = 5;
var LOGIN_MAX_GLOBAL = 30;
async function loginBlockedSeconds(ipHash) {
  const db = getDb();
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [perIp] = await db.select({ n: sql`count(*)`, first: sql`min(created_at)` }).from(schema_exports.loginAttempts).where(and(eq(schema_exports.loginAttempts.ipHash, ipHash), gt(schema_exports.loginAttempts.createdAt, since)));
  const [global] = await db.select({ n: sql`count(*)`, first: sql`min(created_at)` }).from(schema_exports.loginAttempts).where(gt(schema_exports.loginAttempts.createdAt, since));
  const ipBlocked = Number(perIp.n) >= LOGIN_MAX_PER_IP;
  const globalBlocked = Number(global.n) >= LOGIN_MAX_GLOBAL;
  if (!ipBlocked && !globalBlocked) return 0;
  const first = ipBlocked ? perIp.first : global.first;
  const until = new Date(first).getTime() + LOGIN_WINDOW_MS;
  return Math.max(1, Math.ceil((until - Date.now()) / 1e3));
}
async function recordFailedLogin(ipHash) {
  const db = getDb();
  await db.insert(schema_exports.loginAttempts).values({ ipHash });
  await db.delete(schema_exports.loginAttempts).where(lt(schema_exports.loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1e3)));
}
async function clearFailedLogins(ipHash) {
  await getDb().delete(schema_exports.loginAttempts).where(eq(schema_exports.loginAttempts.ipHash, ipHash));
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
var CATEGORIES = {
  florist: "Florist",
  gift: "Gift & Hampers",
  craft: "Craft & Preserved",
  coffee: "Cafe & Treats"
};
var MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
var UPLOAD_DIR = join(process.cwd(), ".uploads");
var blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
var isProd = () => process.env.NODE_ENV === "production" || !!process.env.VERCEL;
var IMAGE_PATTERNS = [
  /^\/assets\/[\w.-]+$/,
  /^\/api\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/,
  /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/products\/[\w.-]+$/
];
var isAllowedImage = (s) => IMAGE_PATTERNS.some((re) => re.test(s));
var text2 = (min, max) => t.String({ minLength: min, maxLength: max });
var productBody = t.Object({
  name: text2(1, 120),
  category: t.Union(Object.keys(CATEGORIES).map((k) => t.Literal(k))),
  price: t.Integer({ minimum: 0, maximum: 1e8 }),
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
  return (process.env.ALLOWED_ORIGIN ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}
function csrfOk(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("x-requested-with") !== "dyflorist") return false;
  const origin = request.headers.get("origin");
  return !!origin && allowedOrigins().includes(origin);
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
  badge: p.badge,
  description: p.description,
  image: p.image,
  rating: p.rating / 10,
  reviews: p.reviews
});
var denied = (status, error) => new Response(JSON.stringify({ error }), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }
});
var app = new Elysia({ prefix: "/api" }).onRequest(async ({ request }) => {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/api/admin")) return;
  if (!csrfOk(request)) return denied(403, "Permintaan ditolak");
  if (path === "/api/admin/login") return;
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
  const ipHash = hashIp(clientIp(request));
  const blocked = await loginBlockedSeconds(ipHash);
  if (blocked > 0) {
    set.status = 429;
    set.headers["retry-after"] = String(blocked);
    return { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(blocked / 60)} menit.` };
  }
  const stored = process.env.ADMIN_PASSWORD_HASH ?? "";
  const ok = stored ? await verifyPassword(body.password, stored) : false;
  if (!ok) {
    if (describeHash(stored) !== "format benar") {
      console.error("Login admin gagal: ADMIN_PASSWORD_HASH " + describeHash(stored));
    }
    await recordFailedLogin(ipHash);
    set.status = 401;
    return { error: "Password salah" };
  }
  await clearFailedLogins(ipHash);
  const { token, expires } = await createSession();
  set.headers["set-cookie"] = sessionCookie(token, expires);
  return { ok: true };
}, { body: t.Object({ password: text2(1, 200) }) }).group(
  "/admin",
  (admin) => admin.get("/session", () => ({ ok: true })).post("/logout", async ({ request, set }) => {
    await destroySession(getCookie(request, SESSION_COOKIE));
    set.headers["set-cookie"] = sessionCookie("", null);
    return { ok: true };
  }).post("/products", async ({ body, set }) => {
    if (!isAllowedImage(body.image)) {
      set.status = 422;
      return { error: "Foto tidak valid" };
    }
    const id = "prod_" + randomUUID().replace(/-/g, "").slice(0, 16);
    await getDb().insert(schema_exports.products).values({
      id,
      ...body,
      categoryName: CATEGORIES[body.category],
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
    await db.update(schema_exports.products).set({ ...body, categoryName: CATEGORIES[body.category] }).where(eq2(schema_exports.products.id, params.id));
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
  }, { body: t.Object({ file: t.File() }) }).get("/orders", async () => {
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
  fetch: (request) => app_default.fetch(request)
};
export {
  handler_default as default
};
