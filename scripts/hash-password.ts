// Membuat ADMIN_PASSWORD_HASH (atau INVITATION_ADMIN_PASSWORD_HASH dengan argumen 'undangan').
// Password diketik tersembunyi (tampil bintang),
// hanya hash yang disalin ke clipboard. Password asli tidak disimpan di mana pun.
import { execSync } from 'node:child_process';
import { hashPassword } from '../server/lib/password';

const ENTER = String.fromCharCode(13);
const NEWLINE = String.fromCharCode(10);
const CTRL_C = String.fromCharCode(3);
const DEL = String.fromCharCode(127);
const BACKSPACE = String.fromCharCode(8);

function askHidden(question: string): Promise<string> {
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
          resolve(value);
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

const TARGET = process.argv[2] === 'undangan' ? 'INVITATION_ADMIN_PASSWORD_HASH' : 'ADMIN_PASSWORD_HASH';
const WHO = TARGET === 'ADMIN_PASSWORD_HASH' ? 'admin utama' : 'Admin Undangan';
const pw = await askHidden(`Password ${WHO} baru (min 12 karakter): `);
if (pw.length < 12) {
  console.error('Terlalu pendek (minimal 12 karakter).');
  process.exit(1);
}
const again = await askHidden('Ketik ulang password yang sama: ');
if (again !== pw) {
  console.error('Kedua password tidak sama. Ulangi.');
  process.exit(1);
}

const hash = await hashPassword(pw);
execSync('clip', { input: hash });
console.log('\nHash password berhasil dibuat dan DISALIN ke clipboard.');
console.log(`Tempel (Ctrl+V) di Vercel sebagai ${TARGET} (Type: Secret).`);
if (TARGET !== 'ADMIN_PASSWORD_HASH') console.log('Gunakan password yang BERBEDA dari password admin utama.');
console.log('Catat password asli Anda di password manager; hash tidak bisa dikembalikan jadi password.');
process.exit(0);
