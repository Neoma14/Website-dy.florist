// Dijalankan otomatis saat build di Vercel: menerapkan migrasi database yang belum jalan.
// - Tanpa DATABASE_URL di komputer lokal: dilewati (build lokal tidak butuh database).
// - Di Vercel tanpa DATABASE_URL: build GAGAL, supaya versi lama tetap tayang dan tidak rusak.
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { getDb } from '../server/db';

if (!process.env.DATABASE_URL) {
  if (process.env.VERCEL) {
    console.error('DATABASE_URL tidak tersedia saat build di Vercel; migrasi tidak bisa dijalankan.');
    process.exit(1);
  }
  console.log('DATABASE_URL tidak diatur (build lokal): migrasi database dilewati.');
  process.exit(0);
}

try {
  await migrate(getDb(), { migrationsFolder: './server/db/migrations' });
  console.log('Migrasi database selesai.');
  process.exit(0);
} catch (e) {
  // Cetak penyebab aslinya (kode + pesan) dengan isi dalam tanda kutip disamarkan
  const err = e as { cause?: { code?: string; errno?: number; message?: string } };
  const cause = err.cause ?? {};
  const msg = String(cause.message ?? (e instanceof Error ? e.message.split('\n')[0] : e)).replace(/'[^']*'/g, "'…'");
  console.error(`Migrasi database gagal. Penyebab: ${cause.code ?? 'tidak diketahui'} (errno ${cause.errno ?? '-'}) — ${msg}`);
  process.exit(1);
}
