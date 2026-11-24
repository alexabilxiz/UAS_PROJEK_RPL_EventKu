import { newDb } from 'pg-mem';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { setPool } from '../src/db.js';
import { migrate } from '../db/migrate.js';

/** Database PostgreSQL in-memory baru untuk setiap file test. */
export async function setupDatabase() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  setPool(pool);
  await migrate(pool);
  return pool;
}

export const api = () => request(createApp());

const PASSWORD = 'RahasiaBanget123';

/** Buat akun langsung di database (lewati rate limit & verifikasi lain), lalu login. */
export async function createUser(pool, { role, email, name = 'Pengguna Uji', organizationId = null, ukwms = false }) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, status, ukwms_verified, organization_id)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)`,
    [id, name, email, bcrypt.hashSync(PASSWORD, 4), role, ukwms, organizationId],
  );
  const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { id, email, password: PASSWORD, token: login.body.accessToken };
}

export async function createOrganization(pool, { name = 'Organisasi Uji', status = 'verified' } = {}) {
  const id = randomUUID();
  await pool.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, $3)`, [id, name, status]);
  return id;
}

export async function createCategory(pool, name = 'Workshop', isActive = true) {
  const id = randomUUID();
  await pool.query(`INSERT INTO categories (id, name, is_active) VALUES ($1, $2, $3)`, [id, name, isActive]);
  return id;
}

export const bearer = (user) => ({ Authorization: `Bearer ${user.token}` });

export function eventBody(categoryId, overrides = {}) {
  const start = new Date(Date.now() + 3 * 86_400_000);
  return {
    title: 'Workshop Uji', description: 'Deskripsi uji.', categoryId,
    startAt: start.toISOString(), endAt: new Date(start.getTime() + 7_200_000).toISOString(),
    locationOrLink: 'Aula Kampus', posterUrl: 'https://example.org/poster.png', quota: 2,
    ...overrides,
  };
}
