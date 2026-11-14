// Cadangan jika email pemulihan tidak sampai: buka semua blokir login admin.
// Jalankan: npm run admin:unblock   (memakai .env.tidb untuk database produksi)
import { getDb, schema } from '../server/db';

const db = getDb();
await db.delete(schema.loginBlocks);
await db.delete(schema.loginAttempts);
console.log('Semua kunci & blokir login admin sudah dibuka.');
process.exit(0);
