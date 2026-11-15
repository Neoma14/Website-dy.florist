// Backup semua data penting ke folder backups/: produk, kategori, harga Bespoke, pesanan, undangan digital (isi,
// data formulir pelanggan) dan ucapan/RSVP tamu. Sesi login, blokir login, dan token pemulihan sengaja TIDAK dicadangkan.
// Pakai:
//   npm run db:backup          -> file JSON saja (membaca DATABASE_URL dari .env.tidb)
//   npm run db:backup:media    -> JSON + unduh semua foto/musik undangan & produk dari Vercel Blob
// Folder backups/ diabaikan git karena berisi data pelanggan (nama, nomor WhatsApp, ucapan tamu).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb, schema } from '../server/db';
import { mediaUrls, parseStoredData } from '../server/invitations/model';

const withMedia = process.argv.includes('--media');
const db = getDb();
const [products, categories, bespokePrices, orders, orderItems, invitations, invitationWishes] = await Promise.all([
  db.select().from(schema.products),
  db.select().from(schema.categories),
  db.select().from(schema.bespokePrices),
  db.select().from(schema.orders),
  db.select().from(schema.orderItems),
  db.select().from(schema.invitations),
  db.select().from(schema.invitationWishes),
]);

mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const file = `backups/dyflorist-${stamp}.json`;
// ipHash tidak perlu dicadangkan (hanya untuk pembatasan spam)
const wishes = invitationWishes.map(({ ipHash: _ip, ...w }) => w);
writeFileSync(
  file,
  JSON.stringify({ dibuat: new Date().toISOString(), products, categories, bespokePrices, orders, orderItems, invitations, invitationWishes: wishes }, null, 2),
  { mode: 0o600 },
);

console.log(`Backup tersimpan: ${file}`);
console.log(`- produk: ${products.length}, kategori: ${categories.length}, harga Bespoke: ${bespokePrices.length}`);
console.log(`- pesanan: ${orders.length} (item: ${orderItems.length})`);
console.log(`- undangan: ${invitations.length}, ucapan tamu: ${invitationWishes.length}`);

if (withMedia) {
  const urls = new Set<string>();
  for (const p of products) urls.add(p.image);
  for (const inv of invitations) {
    for (const u of mediaUrls(parseStoredData(inv.data))) urls.add(u);
    if (inv.intakeData) for (const u of mediaUrls(parseStoredData(inv.intakeData))) urls.add(u);
  }
  const dir = join('backups', `media-${stamp}`);
  mkdirSync(dir, { recursive: true });
  let ok = 0, skipped = 0, failed = 0;
  for (const u of urls) {
    // Hanya berkas di Vercel Blob; /assets/* sudah ada di repositori, /api/uploads/* hanya untuk lokal
    if (!/^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(u)) { skipped++; continue; }
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(String(res.status));
      writeFileSync(join(dir, u.split('/').slice(-2).join('_')), Buffer.from(await res.arrayBuffer()), { mode: 0o600 });
      ok++;
    } catch (e) {
      failed++;
      console.warn(`  gagal mengunduh ${u}: ${(e as Error).message}`);
    }
  }
  console.log(`- media: ${ok} diunduh ke ${dir}, ${skipped} dilewati (berkas bawaan situs), ${failed} gagal`);
}
process.exit(0);
