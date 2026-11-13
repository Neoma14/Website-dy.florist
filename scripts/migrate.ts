import { migrate } from 'drizzle-orm/mysql2/migrator';
import { getDb } from '../server/db';

await migrate(getDb(), { migrationsFolder: './server/db/migrations' });
console.log('Migrasi selesai.');
process.exit(0);
