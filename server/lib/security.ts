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

// --- Pemblokiran login (per IP) ---
// 1) 3x password salah dalam 15 menit  -> dikunci 15 menit (level 1)
// 2) setelah kunci habis, salah lagi  -> diblokir (level 2) sampai dibuka lewat link pemulihan di email
// Batas global 100 gagal / 15 menit tetap berlaku untuk serangan dari banyak IP.
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_PER_IP = 3;
export const LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_GLOBAL = 100;
const LEVEL1_FORGET_MS = 24 * 60 * 60 * 1000; // riwayat kunci dilupakan 24 jam setelah kunci berakhir

export type LoginGate = { state: 'ok' } | { state: 'locked'; retryAfter: number } | { state: 'blocked' };

export async function loginGate(ipHash: string): Promise<LoginGate> {
  const db = getDb();
  const [row] = await db.select().from(schema.loginBlocks).where(eq(schema.loginBlocks.ipHash, ipHash)).limit(1);
  if (row?.level === 2) return { state: 'blocked' };
  if (row?.level === 1 && row.lockedUntil) {
    const until = new Date(row.lockedUntil).getTime();
    if (until > Date.now()) return { state: 'locked', retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1000)) };
    if (until < Date.now() - LEVEL1_FORGET_MS) await db.delete(schema.loginBlocks).where(eq(schema.loginBlocks.ipHash, ipHash));
  }
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [global] = await db.select({ n: sql<number>`count(*)`, first: sql<Date>`min(created_at)` })
    .from(schema.loginAttempts).where(gt(schema.loginAttempts.createdAt, since));
  if (Number(global.n) >= LOGIN_MAX_GLOBAL) {
    const until = new Date(global.first).getTime() + LOGIN_WINDOW_MS;
    return { state: 'locked', retryAfter: Math.max(1, Math.ceil((until - Date.now()) / 1000)) };
  }
  return { state: 'ok' };
}

export type FailResult = { state: 'wrong'; remaining: number } | { state: 'locked'; retryAfter: number } | { state: 'blocked' };

export async function registerFailedLogin(ipHash: string): Promise<FailResult> {
  const db = getDb();
  await db.insert(schema.loginAttempts).values({ ipHash });
  await db.delete(schema.loginAttempts)
    .where(lt(schema.loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));

  const [row] = await db.select().from(schema.loginBlocks).where(eq(schema.loginBlocks.ipHash, ipHash)).limit(1);
  if (row?.level === 1) {
    // Sudah pernah dikunci dan masih salah -> blokir
    await db.update(schema.loginBlocks).set({ level: 2, lockedUntil: null, updatedAt: new Date() })
      .where(eq(schema.loginBlocks.ipHash, ipHash));
    return { state: 'blocked' };
  }
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [perIp] = await db.select({ n: sql<number>`count(*)` }).from(schema.loginAttempts)
    .where(and(eq(schema.loginAttempts.ipHash, ipHash), gt(schema.loginAttempts.createdAt, since)));
  const n = Number(perIp.n);
  if (n >= LOGIN_MAX_PER_IP) {
    const lockedUntil = new Date(Date.now() + LOCK_MS);
    await db.insert(schema.loginBlocks).values({ ipHash, level: 1, lockedUntil })
      .onDuplicateKeyUpdate({ set: { level: 1, lockedUntil, updatedAt: new Date() } });
    return { state: 'locked', retryAfter: Math.ceil(LOCK_MS / 1000) };
  }
  return { state: 'wrong', remaining: LOGIN_MAX_PER_IP - n };
}

export async function clearFailedLogins(ipHash: string) {
  const db = getDb();
  await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.ipHash, ipHash));
  await db.delete(schema.loginBlocks).where(eq(schema.loginBlocks.ipHash, ipHash));
}

// --- Pemulihan: token sekali pakai, berlaku 24 jam; membuka semua blokir login ---
export const RECOVERY_TTL_MS = 24 * 60 * 60 * 1000;

export async function createRecoveryToken(): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const db = getDb();
  await db.insert(schema.recoveryTokens).values({ tokenHash: sha256(token), expiresAt: new Date(Date.now() + RECOVERY_TTL_MS) });
  await db.delete(schema.recoveryTokens).where(lt(schema.recoveryTokens.expiresAt, new Date(Date.now() - RECOVERY_TTL_MS)));
  return token;
}

export async function useRecoveryToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const db = getDb();
  const hash = sha256(token);
  const [row] = await db.select().from(schema.recoveryTokens).where(eq(schema.recoveryTokens.tokenHash, hash)).limit(1);
  if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) return false;
  await db.update(schema.recoveryTokens).set({ usedAt: new Date() }).where(eq(schema.recoveryTokens.tokenHash, hash));
  await db.delete(schema.loginBlocks);
  await db.delete(schema.loginAttempts);
  return true;
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
