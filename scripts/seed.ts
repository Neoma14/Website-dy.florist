import { getDb, schema } from '../server/db';
import { SEED_PRODUCTS } from '../server/db/seed-data';

const db = getDb();
const existing = await db.select({ id: schema.products.id }).from(schema.products).limit(1);
if (existing.length > 0) {
  console.log('Tabel produk sudah berisi data, seed dilewati.');
} else {
  await db.insert(schema.products).values(SEED_PRODUCTS);
  console.log(`${SEED_PRODUCTS.length} produk di-seed.`);
}
process.exit(0);
