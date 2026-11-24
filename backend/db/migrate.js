import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from '../src/db.js';

export async function migrate(pool = getPool()) {
  const sql = await readFile(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');
  await pool.query(sql);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().then(() => console.log('Migrasi selesai.')).catch((error) => {
    console.error('Migrasi gagal:', error.message);
    process.exitCode = 1;
  }).finally(closePool);
}
