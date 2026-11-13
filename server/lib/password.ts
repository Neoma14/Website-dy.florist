import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

// Format: scrypt:N:r:p:saltHex:hashHex (pemisah ':' agar aman dari ekspansi '$' di .env/shell).
// Format lama dengan '$' tetap bisa diverifikasi.
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt:${N}:${R}:${P}:${salt.toString('hex')}:${key.toString('hex')}`;
}

/** Memeriksa bentuk hash tanpa membocorkan isinya (untuk log diagnosis). */
export function describeHash(stored: string | undefined): string {
  if (!stored) return 'kosong/tidak diatur';
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== 'scrypt') return `format salah (${parts.length} bagian, harus 6)`;
  return 'format benar';
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.trim().split(/[:$]/);
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltHex, hashHex] = parts;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await derive(password, Buffer.from(saltHex, 'hex'), +n, +r, +p);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
