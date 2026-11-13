// Merakit DATABASE_URL dari data koneksi TiDB, mengetes koneksi, membuat database,
// menyimpan ke .env.tidb (diabaikan git) dan menyalin URL ke clipboard.
// Password diketik tersembunyi (tampil bintang) dan tidak pernah ditampilkan.
import { createInterface } from 'node:readline';
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import mysql from 'mysql2/promise';

const ENTER = String.fromCharCode(13);
const NEWLINE = String.fromCharCode(10);
const CTRL_C = String.fromCharCode(3);
const DEL = String.fromCharCode(127);
const BACKSPACE = String.fromCharCode(8);

function ask(question: string, hidden = false): Promise<string> {
  if (!hidden) {
    return new Promise((resolve) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
  // Input tersembunyi: baca tombol satu per satu dan tampilkan * saja
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('Jalankan skrip ini di terminal interaktif.'));
      return;
    }
    process.stdout.write(question);
    let value = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === ENTER || ch === NEWLINE) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', onData);
          process.stdout.write(NEWLINE);
          resolve(value.trim());
          return;
        }
        if (ch === CTRL_C) process.exit(1);
        if (ch === DEL || ch === BACKSPACE) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write(BACKSPACE + ' ' + BACKSPACE);
          }
        } else if (ch >= ' ') {
          value += ch;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

const host = await ask('HOST (contoh gateway01.ap-southeast-1.prod.aws.tidbcloud.com): ');
const port = (await ask('PORT [4000]: ')) || '4000';
const user = await ask('USERNAME (contoh abc123.root): ');
const password = await ask('PASSWORD (tampil bintang saat diketik/ditempel): ', true);
const dbName = (await ask('Nama database [dyflorist]: ')) || 'dyflorist';

if (!host || !user || !password) {
  console.error('\nHost, username, dan password wajib diisi.');
  process.exit(1);
}
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  console.error('\nNama database hanya boleh huruf, angka, dan underscore.');
  process.exit(1);
}

try {
  const conn = await mysql.createConnection({
    host, port: Number(port), user, password,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.end();
} catch (e) {
  console.error('\nKoneksi gagal:', e instanceof Error ? e.message : e);
  console.error('Periksa host, username, dan password (copy persis dari TiDB).');
  process.exit(1);
}

const url = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}`;
writeFileSync('.env.tidb', `DATABASE_URL=${url}\nDATABASE_SSL=true\n`, { mode: 0o600 });
execSync('clip', { input: url });

console.log('\nKoneksi BERHASIL dan database sudah siap.');
console.log('- Tersimpan di file .env.tidb (tidak masuk git).');
console.log('- DATABASE_URL sudah disalin ke clipboard: tempel (Ctrl+V) di Vercel.');
