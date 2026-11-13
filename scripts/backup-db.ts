// Backup data penting (produk, pesanan, item pesanan) ke file JSON di folder backups/.
// Pakai: npm run db:backup   (membaca DATABASE_URL dari .env.tidb)
// Folder backups/ diabaikan git karena berisi data pelanggan (nama penerima, catatan).
import { mkdirSync, writeFileSync } from 'node:fs';
import { getDb, schema } from '../server/db';

const db = getDb();
const [products, orders, orderItems] = await Promise.all([
  db.select().from(schema.products),
  db.select().from(schema.orders),
  db.select().from(schema.orderItems),
]);

mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const file = `backups/dyflorist-${stamp}.json`;
writeFileSync(
  file,
  JSON.stringify({ dibuat: new Date().toISOString(), products, orders, orderItems }, null, 2),
  { mode: 0o600 },
);

console.log(`Backup tersimpan: ${file}`);
console.log(`- produk: ${products.length}`);
console.log(`- pesanan: ${orders.length} (item: ${orderItems.length})`);
process.exit(0);
