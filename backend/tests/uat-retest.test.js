import fs from 'node:fs';
import { setupDatabase, api, createUser, createOrganization, createCategory, bearer, eventBody } from './helpers.js';

const results = [];
const rec = (id, area, desc, expected, actual, pass) => results.push({ id, area, desc, expected, actual, status: pass ? 'Pass' : 'Fail' });
afterAll(() => { fs.writeFileSync('./uat_retest.json', JSON.stringify(results, null, 2)); });

test('retest perbaikan BUG-01 dan BUG-02', async () => {
  const pool = await setupDatabase();
  const cat = await createCategory(pool, 'Workshop');
  const orgV = await createOrganization(pool, { name: 'UKM Resmi', status: 'verified' });
  const orgP = await createOrganization(pool, { name: 'UKM Baru', status: 'pending' });
  const admin = await createUser(pool, { role: 'admin', email: 'admin@kampus.test' });
  const real = await createUser(pool, { role: 'penyelenggara', email: 'real@x.test', organizationId: orgV });
  const stu = await createUser(pool, { role: 'mahasiswa', email: 's1@student.ukwms.ac.id', ukwms: true });
  const reg = (body) => api().post('/api/v1/auth/register').send({ name: 'Penyusup', password: 'Rahasia12345', ...body });

  // BUG-02
  let r = await reg({ email: 'p1@mail.test', role: 'penyelenggara', organizationId: orgV });
  rec('R-02-01', 'US-04', 'Registrasi penyelenggara menghasilkan akun berstatus menunggu', '201 pending', `${r.status} ${r.body.status}`, r.status === 201 && r.body.status === 'pending');
  const impostorId = r.body.userId;
  r = await api().post('/api/v1/auth/login').send({ email: 'p1@mail.test', password: 'Rahasia12345' });
  rec('R-02-02', 'US-04', 'Akun menunggu tidak bisa login', '403', `${r.status} ${r.body.message ?? ''}`, r.status === 403 && !r.body.accessToken);
  r = await reg({ email: 'p2@mail.test', role: 'penyelenggara', organizationId: orgV, status: 'active' });
  rec('R-02-03', 'US-04', 'Mass assignment: field status=active pada registrasi diabaikan', 'pending', String(r.body.status), r.body.status === 'pending');
  r = await api().post('/api/v1/auth/login').send({ email: 'p2@mail.test', password: 'Rahasia12345' });
  rec('R-02-04', 'US-04', 'Akun dengan status dipaksa active tetap tidak bisa login', '403', String(r.status), r.status === 403);
  r = await reg({ email: 'm1@student.ukwms.ac.id', role: 'mahasiswa' });
  rec('R-02-05', 'FR-AUTH-01', 'Registrasi mahasiswa tetap langsung aktif', '201 active', `${r.status} ${r.body.status}`, r.status === 201 && r.body.status === 'active');
  r = await api().get('/api/v1/admin/users').set(bearer(admin)).query({ q: 'p1@mail.test' });
  rec('R-02-06', 'FR-ADM-02', 'Admin dapat menemukan akun penyelenggara yang menunggu', 'akun p1 terdaftar', JSON.stringify(r.body).includes('p1@mail.test') ? 'ditemukan' : 'tidak ditemukan', JSON.stringify(r.body).includes('p1@mail.test'));
  r = await api().patch(`/api/v1/admin/users/${impostorId}`).set(bearer(real)).send({ status: 'active' });
  rec('R-02-07', 'FR-AUTH-04', 'Penyelenggara tidak boleh menyetujui akun penyelenggara lain', '403', String(r.status), r.status === 403);
  r = await api().patch(`/api/v1/admin/users/${impostorId}`).set(bearer(stu)).send({ status: 'active' });
  rec('R-02-08', 'FR-AUTH-04', 'Mahasiswa tidak boleh menyetujui akun', '403', String(r.status), r.status === 403);
  r = await api().patch(`/api/v1/admin/users/${impostorId}`).set(bearer(admin)).send({ status: 'active' });
  rec('R-02-09', 'US-04', 'Admin menyetujui akun penyelenggara', '200 active', `${r.status} ${r.body.status}`, r.status === 200 && r.body.status === 'active');
  r = await api().post('/api/v1/auth/login').send({ email: 'p1@mail.test', password: 'Rahasia12345' });
  rec('R-02-10', 'US-04', 'Setelah disetujui admin, penyelenggara bisa login', '200 + token', `${r.status} token=${Boolean(r.body.accessToken)}`, r.status === 200 && !!r.body.accessToken);
  const h = { Authorization: 'Bearer ' + r.body.accessToken };
  r = await api().post('/api/v1/events').set(h).send(eventBody(cat));
  rec('R-02-11', 'US-04', 'Penyelenggara yang sudah disetujui dapat membuat event', '201', String(r.status), r.status === 201);
  const pend = await reg({ email: 'p3@mail.test', role: 'penyelenggara', organizationId: orgP });
  await api().patch(`/api/v1/admin/users/${pend.body.userId}`).set(bearer(admin)).send({ status: 'active' });
  const lg = await api().post('/api/v1/auth/login').send({ email: 'p3@mail.test', password: 'Rahasia12345' });
  r = await api().post('/api/v1/events').set({ Authorization: 'Bearer ' + lg.body.accessToken }).send(eventBody(cat));
  rec('R-02-12', 'FR-AUTH-05', 'Akun disetujui tetapi organisasi belum terverifikasi tetap tidak bisa mengajukan event', '403', String(r.status), r.status === 403);

  // BUG-01
  const login = () => api().post('/api/v1/auth/login').send({ email: 'real@x.test', password: 'Password123!' });
  // helper createUser memakai kata sandi bawaan; ambil dari helpers jika berbeda
  let a = await login();
  if (a.status !== 200) {
    const pw = 'Rahasia12345';
    await api().post('/api/v1/auth/register').send({ name: 'Dua Sesi', email: 'dua@student.ukwms.ac.id', password: pw, role: 'mahasiswa' });
    const l1 = await api().post('/api/v1/auth/login').send({ email: 'dua@student.ukwms.ac.id', password: pw });
    const l2 = await api().post('/api/v1/auth/login').send({ email: 'dua@student.ukwms.ac.id', password: pw });
    a = l1; var b = l2;
  } else { var b = await login(); }
  const t1 = { Authorization: 'Bearer ' + a.body.accessToken }; const t2 = { Authorization: 'Bearer ' + b.body.accessToken };
  r = await api().post('/api/v1/auth/logout').set(t1);
  rec('R-01-01', 'US-02', 'Endpoint logout tersedia dan berhasil', '200', String(r.status), r.status === 200);
  r = await api().get('/api/v1/auth/me').set(t1);
  rec('R-01-02', 'US-02', 'Token lama ditolak setelah logout', '401', String(r.status), r.status === 401);
  r = await api().post('/api/v1/auth/logout').set(t1);
  rec('R-01-03', 'US-02', 'Logout ulang dengan token yang sudah dicabut ditolak', '401', String(r.status), r.status === 401);
  r = await api().get('/api/v1/auth/me').set(t2);
  rec('R-01-04', 'US-02', 'Logout satu perangkat tidak mencabut sesi perangkat lain', '200', String(r.status), r.status === 200);
  r = await api().post('/api/v1/auth/logout');
  rec('R-01-05', 'US-02', 'Logout tanpa token ditolak', '401', String(r.status), r.status === 401);
});
