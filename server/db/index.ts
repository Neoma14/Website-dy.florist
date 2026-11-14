import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

let pool: mysql.Pool | undefined;

export function getDb() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL belum diatur');
    pool = mysql.createPool({
      uri: url,
      connectionLimit: 3,
      charset: 'utf8mb4', // agar emoji (mis. pada kategori) tersimpan dengan benar
      ssl: process.env.DATABASE_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
  }
  return drizzle(pool, { schema, mode: 'default' });
}
export { schema };
