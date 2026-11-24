import { beforeAll, describe, expect, test } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { api, bearer, createCategory, createOrganization, createUser, eventBody, setupDatabase } from './helpers.js';
import { completeFinishedEvents, sendReminders } from '../src/lib/scheduler.js';

let pool; let categoryId; let orgId; let admin; let organizer; let student;
const V1 = '/api/v1';

beforeAll(async () => {
  pool = await setupDatabase();
  categoryId = await createCategory(pool);
  orgId = await createOrganization(pool);
  admin = await createUser(pool, { role: 'admin', email: 'a@t.test' });
  organizer = await createUser(pool, { role: 'penyelenggara', email: 'o@t.test', organizationId: orgId });
  student = await createUser(pool, { role: 'mahasiswa', email: 's@student.ukwms.ac.id', ukwms: true });
});

describe('Autentikasi & otorisasi', () => {
  test('tanpa token / token ngawur / token ditandatangani kunci lain → 401', async () => {
    expect((await api().get(`${V1}/auth/me`)).status).toBe(401);
    expect((await api().get(`${V1}/auth/me`).set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    const forged = jwt.sign({}, 'kunci-lain-kunci-lain-kunci-lain-123', { subject: admin.id, jwtid: randomUUID() });
    expect((await api().get(`${V1}/auth/me`).set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  test('token sah tapi sesinya sudah dihapus (logout/ganti sandi) → 401', async () => {
    const first = (await api().post(`${V1}/auth/login`).send({ email: 'a@t.test', password: 'RahasiaBanget123' })).body.accessToken;
    const second = (await api().post(`${V1}/auth/login`).send({ email: 'a@t.test', password: 'RahasiaBanget123' })).body.accessToken;
    expect((await api().get(`${V1}/auth/me`).set('Authorization', `Bearer ${first}`)).status).toBe(200);
    expect((await api().post(`${V1}/auth/logout`).set('Authorization', `Bearer ${first}`)).status).toBe(200);
    expect((await api().get(`${V1}/auth/me`).set('Authorization', `Bearer ${first}`)).status).toBe(401);
    expect((await api().post(`${V1}/auth/logout`).set('Authorization', `Bearer ${first}`)).status).toBe(401);
    expect((await api().post(`${V1}/auth/logout`)).status).toBe(401);
    expect((await api().get(`${V1}/auth/me`).set('Authorization', `Bearer ${second}`)).status).toBe(200);
  });

  test('akun penyelenggara baru menunggu verifikasi admin sebelum bisa login atau mengakses organisasi', async () => {
    const reg = await api().post(`${V1}/auth/register`).send({
      name: 'Calon Penyelenggara', email: 'calon.org@t.test', password: 'password123', role: 'penyelenggara', organizationId: orgId,
    });
    expect(reg.status).toBe(201);
    expect(reg.body).toMatchObject({ role: 'penyelenggara', status: 'pending', organizationId: orgId });
    expect((await api().post(`${V1}/auth/login`).send({ email: 'calon.org@t.test', password: 'password123' })).status).toBe(403);
    expect((await api().patch(`${V1}/admin/users/${reg.body.userId}`).set(bearer(admin)).send({ status: 'active' })).status).toBe(200);
    const approved = await api().post(`${V1}/auth/login`).send({ email: 'calon.org@t.test', password: 'password123' });
    expect(approved.status).toBe(200);
    expect(approved.body.accessToken).toBeTruthy();
  });

  test('token kedaluwarsa → 401', async () => {
    const jti = randomUUID();
    await pool.query(`INSERT INTO sessions (jti, user_id, expires_at) VALUES ($1, $2, $3)`, [jti, admin.id, new Date(Date.now() - 1000)]);
    const token = jwt.sign({}, process.env.JWT_SECRET, { subject: admin.id, jwtid: jti, expiresIn: 3600 });
    expect((await api().get(`${V1}/auth/me`).set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  test('tidak bisa mendaftar sebagai admin; respons tidak membocorkan hash sandi', async () => {
    const res = await api().post(`${V1}/auth/register`).send({ name: 'Jahat', email: 'j@t.test', password: 'password123', role: 'admin' });
    expect(res.status).toBe(422);
    expect(res.body.fieldErrors.role).toBeDefined();
    const me = await api().get(`${V1}/auth/me`).set(bearer(student));
    expect(JSON.stringify(me.body)).not.toMatch(/password|hash/i);
  });

  test('peran salah → 403 pada setiap kelompok endpoint', async () => {
    for (const [method, path, user] of [
      ['get', '/admin/users', student], ['get', '/admin/users', organizer],
      ['get', '/organizer/events', student], ['get', '/student/favorites', organizer],
      ['get', '/registrations/me', organizer], ['get', '/notifications/me', student],
      ['post', '/assets/posters', student],
    ]) {
      const res = await api()[method](`${V1}${path}`).set(bearer(user)).send({});
      expect([path, res.status]).toEqual([path, 403]);
    }
  });

  test('admin tidak bisa dinonaktifkan; penyelenggara lain tidak bisa menyentuh event orang', async () => {
    const eventRes = await api().post(`${V1}/events`).set(bearer(organizer)).send(eventBody(categoryId));
    const id = eventRes.body.eventId;
    const otherOrg = await createUser(pool, { role: 'penyelenggara', email: 'o2@t.test', organizationId: await createOrganization(pool, { name: 'Lain' }) });
    expect((await api().patch(`${V1}/events/${id}/submit`).set(bearer(otherOrg))).status).toBe(404);
    expect((await api().get(`${V1}/organizer/events/${id}`).set(bearer(otherOrg))).status).toBe(404);
    expect((await api().get(`${V1}/events/${id}`).set(bearer(otherOrg))).status).toBe(404); // draft orang lain tersembunyi
    expect((await api().get(`${V1}/events/${id}`).set(bearer(organizer))).status).toBe(200);
    expect((await api().get(`${V1}/events/${id}`)).status).toBe(404);
  });
});

describe('Input jahat / tidak valid', () => {
  test('ID bukan UUID → 404, bukan 500', async () => {
    for (const path of ['/events/1', '/events/abc', `/events/${encodeURIComponent("' OR 1=1 --")}`, '/registrations/xyz']) {
      const res = await api()[path.startsWith('/reg') ? 'delete' : 'get'](`${V1}${path}`).set(bearer(student));
      expect([path, res.status]).toEqual([path, 404]);
    }
  });

  test('SQL injection pada q/category diperlakukan sebagai teks biasa', async () => {
    const res = await api().get(`${V1}/events`).query({ q: "'; DROP TABLE events; --", category: "x' OR '1'='1" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect((await pool.query('SELECT COUNT(*) AS n FROM events')).rows[0].n).toBeGreaterThan(0);
  });

  test('JSON rusak → 400; body kebesaran → 413; parameter paging aneh dirapikan', async () => {
    const broken = await api().post(`${V1}/auth/login`).set('Content-Type', 'application/json').send('{"email": ');
    expect(broken.status).toBe(400);
    const huge = await api().post(`${V1}/auth/login`).send({ email: 'a@b.c', password: 'x'.repeat(100_000) });
    expect(huge.status).toBe(413);
    const paging = await api().get(`${V1}/events`).query({ page: '-5', limit: '9999' });
    expect(paging.body.page).toBe(1);
    expect((await api().get(`${V1}/events`).query({ date: '2026-13-45' })).status).toBe(422);
    expect((await api().get(`${V1}/nope`)).status).toBe(404);
  });

  test('tipe data salah pada body tidak menyebabkan 500', async () => {
    const weird = [{ email: ['a'], password: {} }, { email: 123, password: 123 }, null];
    for (const body of weird) {
      const res = await api().post(`${V1}/auth/login`).send(body ?? {});
      expect(res.status).toBe(401);
    }
    const ev = await api().post(`${V1}/events`).set(bearer(organizer)).send({ title: {}, categoryId: 5, quota: '2', startAt: [], posterUrl: 7 });
    expect(ev.status).toBe(422);
    expect(Object.keys(ev.body.fieldErrors)).toEqual(expect.arrayContaining(['title', 'categoryId', 'quota', 'startAt', 'posterUrl']));
  });

  test('poster: bukan HTTPS ditolak (javascript:, http:)', async () => {
    for (const posterUrl of ['javascript:alert(1)', 'http://example.org/a.png', '//evil.test/a.png', '/api/v1/assets/posters/' + randomUUID()]) {
      const res = await api().post(`${V1}/events`).set(bearer(organizer)).send(eventBody(categoryId, { posterUrl }));
      expect([posterUrl, res.status]).toEqual([posterUrl, 422]);
    }
  });

  test('header keamanan dan CORS', async () => {
    const res = await api().get(`${V1}/categories`).set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    const bad = await api().get(`${V1}/categories`).set('Origin', 'https://evil.test');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Pemulihan kata sandi', () => {
  const sha = (value) => createHash('sha256').update(value).digest('hex');

  test('email terdaftar dan tidak terdaftar mendapat jawaban identik', async () => {
    const known = await api().post(`${V1}/auth/forgot-password`).send({ email: 's@student.ukwms.ac.id' });
    const unknown = await api().post(`${V1}/auth/forgot-password`).send({ email: 'hantu@t.test' });
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(known.body).toEqual(unknown.body);
    expect(JSON.stringify(known.body)).not.toMatch(/token|demoResetPath/);
    expect((await pool.query(`SELECT COUNT(*) AS n FROM password_resets WHERE user_id = $1`, [student.id])).rows[0].n).toBe(1);
  });

  test('token sekali pakai, kedaluwarsa ditolak, sesi lama dicabut', async () => {
    const token = 'a'.repeat(64);
    await pool.query(`DELETE FROM password_resets WHERE user_id = $1`, [student.id]);
    await pool.query(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, [sha(token), student.id, new Date(Date.now() + 60_000)]);
    expect((await api().post(`${V1}/auth/reset-password`).send({ token, password: 'pendek' })).status).toBe(422);
    expect((await api().post(`${V1}/auth/reset-password`).send({ token, password: 'sandibaru123' })).status).toBe(200);
    expect((await api().post(`${V1}/auth/reset-password`).send({ token, password: 'sandibaru456' })).status).toBe(422);
    expect((await api().get(`${V1}/auth/me`).set(bearer(student))).status).toBe(401);
    expect((await api().post(`${V1}/auth/login`).send({ email: 's@student.ukwms.ac.id', password: 'sandibaru123' })).status).toBe(200);

    const old = 'b'.repeat(64);
    await pool.query(`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, [sha(old), student.id, new Date(Date.now() - 1000)]);
    expect((await api().post(`${V1}/auth/reset-password`).send({ token: old, password: 'sandibaru789' })).status).toBe(422);
  });
});

describe('Scheduler', () => {
  async function insertEvent({ status, start, end, quota = 5 }) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO events (id, organization_id, category_id, title, description, start_at, end_at, location_or_link, poster_url, registration_mode, quota, reserved_seats, status)
       VALUES ($1,$2,$3,'Event Jadwal','d',$4,$5,'Aula','https://example.org/p.png','internal',$6,0,$7)`,
      [id, orgId, categoryId, start, end, quota, status],
    );
    return id;
  }

  test('event tayang yang sudah berakhir menjadi selesai', async () => {
    const past = await insertEvent({ status: 'disetujui', start: new Date(Date.now() - 7_200_000), end: new Date(Date.now() - 3_600_000) });
    const future = await insertEvent({ status: 'disetujui', start: new Date(Date.now() + 3_600_000), end: new Date(Date.now() + 7_200_000) });
    await completeFinishedEvents();
    const status = async (id) => (await pool.query(`SELECT status FROM events WHERE id = $1`, [id])).rows[0].status;
    expect(await status(past)).toBe('selesai');
    expect(await status(future)).toBe('disetujui');
  });

  test('pengingat H-1 terkirim tepat sekali', async () => {
    const soon = await insertEvent({ status: 'disetujui', start: new Date(Date.now() + 12 * 3_600_000), end: new Date(Date.now() + 14 * 3_600_000) });
    const far = await insertEvent({ status: 'disetujui', start: new Date(Date.now() + 5 * 86_400_000), end: new Date(Date.now() + 5 * 86_400_000 + 3_600_000) });
    for (const id of [soon, far]) {
      await pool.query(`INSERT INTO registrations (id, event_id, user_id, status) VALUES ($1, $2, $3, 'aktif')`, [randomUUID(), id, student.id]);
    }
    expect(await sendReminders()).toBe(1);
    expect(await sendReminders()).toBe(0);
    const rows = (await pool.query(`SELECT event_id FROM student_notifications WHERE user_id = $1 AND type = 'pengingat'`, [student.id])).rows;
    expect(rows).toEqual([{ event_id: soon }]);
  });
});
