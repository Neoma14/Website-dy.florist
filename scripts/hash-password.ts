import { createInterface } from 'node:readline';
import { hashPassword } from '../server/lib/password';

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Password admin baru (min 12 karakter): ', async (pw) => {
  rl.close();
  if (pw.length < 12) {
    console.error('Terlalu pendek (min 12 karakter).');
    process.exit(1);
  }
  console.log('\nTempel baris ini ke ADMIN_PASSWORD_HASH (Vercel env var):\n');
  console.log(await hashPassword(pw));
});
