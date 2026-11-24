import { expect, test } from '@jest/globals';
import { newDb } from 'pg-mem';
import { setPool } from '../src/db.js';
import { seed, seedData } from '../db/seed.js';
import { migrate } from '../db/migrate.js';
import { api } from './helpers.js';

test('seed membuat admin + kategori + demo tanpa duplikat saat diulang; admin bisa login', async () => {
  const { Pool } = newDb().adapters.createPg();
  const pool = new Pool();
  setPool(pool);
  await migrate(pool);

  const env = { ADMIN_EMAIL: 'Admin@Kampus.test', ADMIN_PASSWORD: 'AdminKuat123', SEED_DEMO: 'true' };
  await seedData(pool, env);
  await seedData(pool, env); // tidak menggandakan data

  const count = async (table) => (await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n;
  expect(await count('categories')).toBe(3);
  expect(await count('organizations')).toBe(2);
  expect(await count('events')).toBe(6);
  expect((await pool.query(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`)).rows[0].n).toBe(2); // admin env + admin demo

  const login = await api().post('/api/v1/auth/login').send({ email: 'admin@kampus.test', password: 'AdminKuat123' });
  expect(login.status).toBe(200);
  expect(login.body.user.role).toBe('admin');
  const catalog = await api().get('/api/v1/events');
  expect(catalog.body.total).toBe(6);
});

test('seed menolak ADMIN_PASSWORD pendek', async () => {
  const { Pool } = newDb().adapters.createPg();
  const pool = new Pool();
  setPool(pool);
  await expect(seed(pool, { ADMIN_EMAIL: 'a@b.test', ADMIN_PASSWORD: 'pendek' })).rejects.toThrow(/minimal 8/);
});
