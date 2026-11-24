import pg from 'pg';
import { config } from './config.js';

// COUNT/SUM dari PostgreSQL berupa bigint (string); ubah ke number.
pg.types.setTypeParser(20, (value) => Number(value));

let pool = null;

/** Dipakai test untuk memasang database in-memory. */
export function setPool(instance) {
  pool = instance;
}

export function getPool() {
  if (!pool) {
    if (!config.databaseUrl) throw new Error('DATABASE_URL belum diisi.');
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return pool;
}

export function query(text, params = []) {
  return getPool().query(text, params);
}

/** Jalankan beberapa query dalam satu transaksi. */
export async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work((text, params = []) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* koneksi sudah putus */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) await pool.end();
  pool = null;
}
