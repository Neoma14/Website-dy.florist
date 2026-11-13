import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';

export const SESSION_COOKIE = 'dyf_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 jam

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function hashIp(ip: string): string {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error('APP_SECRET belum diatur (min 32 karakter)');
  return sha256(secret + ':' + ip);
}

export function clientIp(request: Request): string {
  // Vercel mengisi x-forwarded-for dengan IP klien asli di entri pertama
  const xff = request.headers.get('x-forwarded-for');
  return (xff?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown').trim();
}

export async function createSession(): Promise<{ token: string; expires: Date }> {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ tokenHash: sha256(token), expiresAt: expires });
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  return { token, expires };
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const rows = await getDb().select().from(schema.sessions)
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows.length === 1;
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  await getDb().delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
}

// --- Pemblokiran login: 5 gagal / 15 menit per IP, 30 gagal / 15 menit global ---
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 5;
const LOGIN_MAX_GLOBAL = 30;

export async function loginBlockedSeconds(ipHash: string): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [perIp] = await db.select({ n: sql<number>`count(*)`, first: sql<Date>`min(created_at)` })
    .from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.ipHash, ipHash), gt(schema.loginAttempts.createdAt, since)));
  const [global] = await db.select({ n: sql<number>`count(*)`, first: sql<Date>`min(created_at)` })
    .from(schema.loginAttempts).where(gt(schema.loginAttempts.createdAt, since));
  const ipBlocked = Number(perIp.n) >= LOGIN_MAX_PER_IP;
  const globalBlocked = Number(global.n) >= LOGIN_MAX_GLOBAL;
  if (!ipBlocked && !globalBlocked) return 0;
  const first = ipBlocked ? perIp.first : global.first;
  const until = new Date(first).getTime() + LOGIN_WINDOW_MS;
  return Math.max(1, Math.ceil((until - Date.now()) / 1000));
}

export async function recordFailedLogin(ipHash: string) {
  const db = getDb();
  await db.insert(schema.loginAttempts).values({ ipHash });
  await db.delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export async function clearFailedLogins(ipHash: string) {
  await getDb().delete(schema.loginAttempts).where(eq(schema.loginAttempts.ipHash, ipHash));
}

// --- Rate limit umum (mis. pesanan publik) ---
export async function rateLimited(bucket: string, ipHash: string, max: number, windowMs: number): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(schema.rateEvents)
    .where(and(eq(schema.rateEvents.bucket, bucket), eq(schema.rateEvents.ipHash, ipHash),
      gt(schema.rateEvents.createdAt, since)));
  if (Number(row.n) >= max) return true;
  await db.insert(schema.rateEvents).values({ bucket, ipHash });
  await db.delete(schema.rateEvents)
    .where(lt(schema.rateEvents.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  return false;
}

// --- Validasi gambar dari isi file (magic bytes) ---
export function detectImageType(buf: Uint8Array): 'jpg' | 'png' | 'webp' | null {
  if (buf.length > 12) {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
  }
  return null;
}
