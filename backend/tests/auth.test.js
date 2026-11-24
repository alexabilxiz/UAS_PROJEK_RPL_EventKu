import { beforeAll, describe, expect, test } from '@jest/globals';
import { api, bearer, createOrganization, createUser, setupDatabase } from './helpers.js';

const V1 = '/api/v1';
let pool; let orgId; let student;

beforeAll(async () => {
  pool = await setupDatabase();
  orgId = await createOrganization(pool);
  student = await createUser(pool, { role: 'mahasiswa', email: 'mhs@student.ukwms.ac.id', ukwms: true });
});

describe('Auth - register', () => {
  test('mahasiswa UKWMS valid -> 201 dan terverifikasi UKWMS', async () => {
    const res = await api().post(`${V1}/auth/register`).send({
      name: 'Mahasiswa Baru', email: 'baru@student.ukwms.ac.id', password: 'Rahasia123!', role: 'mahasiswa',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'mahasiswa', status: 'active' });
    const login = await api().post(`${V1}/auth/login`).send({ email: 'baru@student.ukwms.ac.id', password: 'Rahasia123!' });
    expect(login.body.user.ukwmsVerified).toBe(true);
  });

  test('email dobel -> 409', async () => {
    const res = await api().post(`${V1}/auth/register`).send({
      name: 'Dobel', email: 'mhs@student.ukwms.ac.id', password: 'Rahasia123!', role: 'mahasiswa',
    });
    expect(res.status).toBe(409);
  });

  test('sandi < 8 karakter -> 422 dengan fieldErrors.password', async () => {
    const res = await api().post(`${V1}/auth/register`).send({
      name: 'Pendek', email: 'p@student.ukwms.ac.id', password: 'abc', role: 'mahasiswa',
    });
    expect(res.status).toBe(422);
    expect(res.body.fieldErrors.password).toBeDefined();
  });

  test('penyelenggara terhubung ke organisasi', async () => {
    const res = await api().post(`${V1}/auth/register`).send({
      name: 'Panitia', email: 'panitia@ukm.test', password: 'Rahasia123!', role: 'penyelenggara', organizationId: orgId,
    });
    expect(res.status).toBe(201);
    expect(res.body.organizationId).toBe(orgId);
  });
});

describe('Auth - login & sesi', () => {
  test('login benar -> 200 + accessToken, tanpa hash sandi', async () => {
    const res = await api().post(`${V1}/auth/login`).send({ email: 'mhs@student.ukwms.ac.id', password: 'RahasiaBanget123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('sandi salah dan email tak terdaftar -> 401 dengan pesan identik', async () => {
    const a = await api().post(`${V1}/auth/login`).send({ email: 'mhs@student.ukwms.ac.id', password: 'salahsalah' });
    const b = await api().post(`${V1}/auth/login`).send({ email: 'gaib@student.ukwms.ac.id', password: 'salahsalah' });
    expect([a.status, b.status]).toEqual([401, 401]);
    expect(a.body.message).toBe(b.body.message);
  });

  test('/auth/me: tanpa token 401, dengan token 200', async () => {
    expect((await api().get(`${V1}/auth/me`)).status).toBe(401);
    const res = await api().get(`${V1}/auth/me`).set(bearer(student));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('mhs@student.ukwms.ac.id');
  });
});