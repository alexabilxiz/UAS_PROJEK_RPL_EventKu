import fs from 'node:fs';
import { setupDatabase, api, createUser, createOrganization, createCategory, bearer, eventBody } from './helpers.js';

const results = [];
const rec = (id, area, desc, expected, actual, pass, note = '') => results.push({ id, area, desc, expected, actual, status: pass ? 'Pass' : 'Fail', note });

let pool, cat, cat2, orgOK, orgPending, admin, org1, org2, orgPend, stu, stu2, stuExt;

beforeAll(async () => {
  pool = await setupDatabase();
  cat = await createCategory(pool, 'Workshop');
  cat2 = await createCategory(pool, 'Seminar');
  orgOK = await createOrganization(pool, { name: 'UKM A', status: 'verified' });
  const orgB = await createOrganization(pool, { name: 'UKM B', status: 'verified' });
  orgPending = await createOrganization(pool, { name: 'UKM Baru', status: 'pending' });
  admin = await createUser(pool, { role: 'admin', email: 'admin@kampus.test' });
  org1 = await createUser(pool, { role: 'penyelenggara', email: 'o1@x.test', organizationId: orgOK });
  org2 = await createUser(pool, { role: 'penyelenggara', email: 'o2@x.test', organizationId: orgB });
  orgPend = await createUser(pool, { role: 'penyelenggara', email: 'o3@x.test', organizationId: orgPending });
  stu = await createUser(pool, { role: 'mahasiswa', email: 's1@student.ukwms.ac.id', ukwms: true });
  stu2 = await createUser(pool, { role: 'mahasiswa', email: 's2@student.ukwms.ac.id', ukwms: true });
  stuExt = await createUser(pool, { role: 'mahasiswa', email: 'ext@gmail.com', ukwms: false });
});

afterAll(() => { fs.writeFileSync('./uat_results.json', JSON.stringify(results, null, 2)); });

test('AUTH', async () => {
  let r = await api().post('/api/v1/auth/register').send({ name: 'Baru', email: 'baru@student.ukwms.ac.id', password: 'Rahasia12345', role: 'mahasiswa' });
  rec('T-AUTH-01', 'FR-AUTH-01', 'Registrasi mahasiswa dengan data valid', '201', String(r.status), r.status === 201);
  r = await api().post('/api/v1/auth/register').send({ name: 'Baru', email: 'baru@student.ukwms.ac.id', password: 'Rahasia12345', role: 'mahasiswa' });
  rec('T-AUTH-02', 'FR-AUTH-01', 'Registrasi dengan email duplikat ditolak', '409', String(r.status), r.status === 409);
  r = await api().post('/api/v1/auth/register').send({ name: 'X', email: 'x@y.test', password: 'pendek', role: 'mahasiswa' });
  rec('T-AUTH-03', 'FR-AUTH-01', 'Kata sandi < 8 karakter ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  r = await api().post('/api/v1/auth/register').send({ name: 'Adm', email: 'adm2@y.test', password: 'Rahasia12345', role: 'admin' });
  rec('T-AUTH-04', 'FR-AUTH-04', 'Registrasi publik dengan peran admin ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  r = await api().post('/api/v1/auth/login').send({ email: 'baru@student.ukwms.ac.id', password: 'Rahasia12345' });
  rec('T-AUTH-05', 'FR-AUTH-03', 'Login valid mengembalikan token', '200 + accessToken', `${r.status} token=${Boolean(r.body.accessToken)}`, r.status === 200 && !!r.body.accessToken);
  const tok = r.body.accessToken;
  r = await api().post('/api/v1/auth/login').send({ email: 'baru@student.ukwms.ac.id', password: 'salahsalah1' });
  rec('T-AUTH-06', 'FR-AUTH-03', 'Login dengan kata sandi salah ditolak', '401', String(r.status), r.status === 401);
  r = await api().get('/api/v1/auth/me').set('Authorization', 'Bearer ' + tok);
  rec('T-AUTH-07', 'FR-AUTH-03', 'Endpoint /me dengan token valid', '200', String(r.status), r.status === 200);
  // logout: tidak ada endpoint
  r = await api().post('/api/v1/auth/logout').set('Authorization', 'Bearer ' + tok);
  const after = await api().get('/api/v1/auth/me').set('Authorization', 'Bearer ' + tok);
  rec('T-AUTH-08', 'US-02 / FR-AUTH-03', 'Logout menghapus sesi di server (token lama harus ditolak)', 'Token lama 401 setelah logout', `POST /auth/logout=${r.status}; token lama sesudahnya=${after.status}`, after.status === 401, 'Tidak ada endpoint logout di backend; logout hanya menghapus token di klien.');
  r = await api().get('/api/v1/auth/me').set('Authorization', 'Bearer ' + tok.slice(0, -3) + 'abc');
  rec('T-AUTH-09', 'NFR-SEC-02', 'Token JWT yang dimanipulasi ditolak', '401', String(r.status), r.status === 401);
  r = await api().get('/api/v1/auth/me');
  rec('T-AUTH-10', 'NFR-SEC-03', 'Akses tanpa token ditolak', '401', String(r.status), r.status === 401);
});

test('RBAC', async () => {
  let r = await api().post('/api/v1/events').set(bearer(stu)).send(eventBody(cat));
  rec('T-RBAC-01', 'FR-AUTH-04', 'Mahasiswa tidak boleh membuat event', '403', String(r.status), r.status === 403);
  r = await api().get('/api/v1/admin/users').set(bearer(org1));
  rec('T-RBAC-02', 'FR-AUTH-04', 'Penyelenggara tidak boleh mengakses endpoint admin', '403', String(r.status), r.status === 403);
  r = await api().post('/api/v1/events/' + '00000000-0000-4000-8000-000000000000' + '/registrations').set(bearer(org1));
  rec('T-RBAC-03', 'FR-AUTH-04', 'Penyelenggara tidak boleh RSVP', '403', String(r.status), r.status === 403);
  r = await api().get('/api/v1/organizer/events').set(bearer(stu));
  rec('T-RBAC-04', 'FR-AUTH-04', 'Mahasiswa tidak boleh membuka dashboard penyelenggara', '403', String(r.status), r.status === 403);
  r = await api().patch('/api/v1/admin/events/moderation/00000000-0000-4000-8000-000000000000').set(bearer(org1)).send({ status: 'disetujui' });
  rec('T-RBAC-05', 'FR-MOD-01', 'Penyelenggara tidak boleh memoderasi event', '403', String(r.status), r.status === 403);
});

let ev, evQuota;
test('EVENT + MODERASI', async () => {
  let r = await api().post('/api/v1/events').set(bearer(orgPend)).send(eventBody(cat));
  rec('T-EVT-01', 'FR-AUTH-05', 'Organisasi belum terverifikasi tidak boleh mengajukan event', '403', String(r.status), r.status === 403);
  r = await api().post('/api/v1/events').set(bearer(org1)).send(eventBody(cat, { title: '' }));
  rec('T-EVT-02', 'FR-EVT-02', 'Event tanpa judul ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  const s = new Date(Date.now() + 5 * 86400000);
  r = await api().post('/api/v1/events').set(bearer(org1)).send(eventBody(cat, { startAt: s.toISOString(), endAt: new Date(s.getTime() - 3600000).toISOString() }));
  rec('T-EVT-03', 'FR-EVT-02', 'Waktu selesai sebelum mulai ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  r = await api().post('/api/v1/events').set(bearer(org1)).send(eventBody(cat, { startAt: new Date(Date.now() - 86400000).toISOString() }));
  rec('T-EVT-04', 'FR-EVT-02', 'Waktu mulai di masa lalu ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  r = await api().post('/api/v1/events').set(bearer(org1)).send(eventBody(cat, { quota: 0 }));
  rec('T-EVT-05', 'FR-EVT-02', 'Kuota 0 ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  r = await api().post('/api/v1/events').set(bearer(org1)).send(eventBody(cat, { title: 'Seminar <script>alert(1)</script> AI', quota: 5 }));
  rec('T-EVT-06', 'FR-EVT-01', 'Membuat draft event valid', '201 draft', `${r.status} ${r.body.status}`, r.status === 201 && r.body.status === 'draft');
  ev = r.body.eventId;
  r = await api().get('/api/v1/events').query({ q: 'Seminar' });
  rec('T-EVT-07', 'FR-SRC-01', 'Draft tidak tampil di katalog publik', '0 hasil', String(r.body.total), r.body.total === 0);
  r = await api().patch(`/api/v1/events/${ev}/submit`).set(bearer(org2));
  rec('T-EVT-08', 'NFR-SEC-03', 'Penyelenggara organisasi lain tidak boleh mengajukan draft ini', '404', String(r.status), r.status === 404);
  r = await api().patch(`/api/v1/events/${ev}/submit`).set(bearer(org1));
  rec('T-EVT-09', 'FR-EVT-03', 'Ajukan draft -> menunggu moderasi', '200 menunggu_moderasi', `${r.status} ${r.body.status}`, r.status === 200 && r.body.status === 'menunggu_moderasi');
  r = await api().patch(`/api/v1/events/${ev}/submit`).set(bearer(org1));
  rec('T-EVT-10', 'FR-EVT-03', 'Pengajuan ganda ditolak', '409', String(r.status), r.status === 409);
  r = await api().get('/api/v1/events').query({ q: 'Seminar' });
  rec('T-EVT-11', 'FR-MOD-01', 'Event menunggu moderasi belum tampil publik', '0 hasil', String(r.body.total), r.body.total === 0);
  r = await api().get('/api/v1/admin/events/moderation').set(bearer(admin));
  rec('T-MOD-01', 'FR-MOD-01', 'Admin melihat antrean moderasi', 'total >= 1', String(r.body.total), r.body.total >= 1);
  r = await api().patch(`/api/v1/admin/events/moderation/${ev}`).set(bearer(admin)).send({ status: 'ditolak', reason: '' });
  rec('T-MOD-02', 'FR-MOD-02', 'Penolakan tanpa alasan ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  // minat -> notifikasi
  await api().put('/api/v1/student/interests').set(bearer(stu)).send({ categoryIds: [cat] });
  await api().put('/api/v1/student/interests').set(bearer(stu2)).send({ categoryIds: [cat2] });
  r = await api().patch(`/api/v1/admin/events/moderation/${ev}`).set(bearer(admin)).send({ status: 'disetujui' });
  rec('T-MOD-03', 'FR-MOD-03', 'Admin menyetujui event', '200 disetujui', `${r.status} ${r.body.status}`, r.status === 200 && r.body.status === 'disetujui');
  r = await api().patch(`/api/v1/admin/events/moderation/${ev}`).set(bearer(admin)).send({ status: 'disetujui' });
  rec('T-MOD-04', 'FR-MOD-03', 'Moderasi ulang event yang sudah diputuskan ditolak', '409', String(r.status), r.status === 409);
  r = await api().get('/api/v1/organizer/events').set(bearer(org1));
  r = await api().get('/api/v1/notifications/me').set(bearer(org1));
  rec('T-MOD-05', 'FR-MOD-04', 'Penyelenggara menerima notifikasi hasil moderasi', '>=1 notifikasi', JSON.stringify(r.body).slice(0, 120), r.status === 200 && JSON.stringify(r.body).includes('disetujui'));
  r = await api().get('/api/v1/admin/events/moderation').query({ scope: 'history' }).set(bearer(admin));
  rec('T-MOD-06', 'FR-MOD-06', 'Riwayat moderasi tercatat', 'total >= 1', String(r.body.total), r.body.total >= 1);
  r = await api().get('/api/v1/student/notifications').set(bearer(stu));
  rec('T-NTF-01', 'FR-NTF-02', 'Mahasiswa berminat kategori tersebut menerima notifikasi event baru', 'ada tipe event_baru', JSON.stringify(r.body.data?.map((n) => n.type)), r.body.data?.some((n) => n.type === 'event_baru'));
  r = await api().get('/api/v1/student/notifications').set(bearer(stu2));
  rec('T-NTF-02', 'FR-NTF-02', 'Mahasiswa kategori lain TIDAK menerima notifikasi', 'tidak ada event_baru', JSON.stringify(r.body.data?.map((n) => n.type)), !r.body.data?.some((n) => n.type === 'event_baru'));
});

test('KATALOG', async () => {
  let r = await api().get('/api/v1/events');
  rec('T-SRC-01', 'FR-SRC-01', 'Daftar event publik menampilkan event disetujui', 'total >= 1', String(r.body.total), r.body.total >= 1);
  r = await api().get('/api/v1/events').query({ q: 'seminar' });
  rec('T-SRC-02', 'FR-SRC-02', 'Pencarian kata kunci tidak sensitif huruf besar-kecil', 'total >= 1', String(r.body.total), r.body.total >= 1);
  r = await api().get('/api/v1/events').query({ q: 'tidakadaxyz' });
  rec('T-SRC-03', 'FR-SRC-02', 'Pencarian tanpa hasil mengembalikan daftar kosong', '0', String(r.body.total), r.body.total === 0);
  r = await api().get('/api/v1/events').query({ category: cat });
  const a = r.body.total;
  r = await api().get('/api/v1/events').query({ category: cat2 });
  rec('T-SRC-04', 'FR-SRC-03', 'Filter kategori sesuai data', 'cat=1, cat2=0', `cat=${a}, cat2=${r.body.total}`, a >= 1 && r.body.total === 0);
  r = await api().get('/api/v1/events').query({ q: "'; DROP TABLE events;--" });
  const chk = await api().get('/api/v1/events');
  rec('T-SEC-01', 'NFR-SEC-04', 'Input SQL injection pada pencarian tidak merusak data', '200 & data utuh', `${r.status}, total=${chk.body.total}`, r.status === 200 && chk.body.total >= 1);
  r = await api().get('/api/v1/events').query({ date: 'bukan-tanggal' });
  rec('T-SRC-05', 'FR-SRC-03', 'Filter tanggal tidak valid ditolak', '4xx', String(r.status), r.status >= 400 && r.status < 500);
  r = await api().get('/api/v1/events/' + ev);
  const title = r.body.event?.title;
  rec('T-SEC-02', 'NFR-SEC-04', 'Judul berisi <script> tidak dieksekusi (API mengembalikan teks apa adanya; escape dilakukan React)', 'teks tersimpan sebagai string', String(title), typeof title === 'string', 'Perlu dicek manual di UI bahwa tidak dirender sebagai HTML.');
  r = await api().get('/api/v1/events/bukan-uuid');
  rec('T-SRC-06', 'FR-DET-01', 'ID event tidak valid -> 404', '404', String(r.status), r.status === 404);
});

test('RSVP', async () => {
  let r = await api().post('/api/v1/events').set(bearer(org1)).send(eventBody(cat, { title: 'Kuota Satu', quota: 1 }));
  evQuota = r.body.eventId;
  await api().patch(`/api/v1/events/${evQuota}/submit`).set(bearer(org1));
  await api().patch(`/api/v1/admin/events/moderation/${evQuota}`).set(bearer(admin)).send({ status: 'disetujui' });
  r = await api().post(`/api/v1/events/${evQuota}/registrations`).set(bearer(stuExt));
  rec('T-RSV-01', 'FR-RSV-01', 'Mahasiswa non-UKWMS tidak boleh RSVP', '403', String(r.status), r.status === 403);
  const [a, b] = await Promise.all([
    api().post(`/api/v1/events/${evQuota}/registrations`).set(bearer(stu)),
    api().post(`/api/v1/events/${evQuota}/registrations`).set(bearer(stu2)),
  ]);
  const codes = [a.status, b.status].sort();
  rec('T-RSV-02', 'FR-RSV-02', 'Dua permintaan untuk kursi terakhir: hanya satu berhasil', '[201,409]', JSON.stringify(codes), codes[0] === 201 && codes[1] === 409, 'Dijalankan pada pg-mem (single-thread); konkurensi nyata PostgreSQL perlu uji terpisah.');
  const winner = a.status === 201 ? stu : stu2; const loser = winner === stu ? stu2 : stu;
  const regId = (a.status === 201 ? a : b).body.registrationId;
  r = await api().post(`/api/v1/events/${evQuota}/registrations`).set(bearer(winner));
  rec('T-RSV-03', 'FR-RSV-06', 'RSVP ganda pada event yang sama ditolak', '409', String(r.status), r.status === 409);
  r = await api().delete(`/api/v1/registrations/${regId}`).set(bearer(loser));
  rec('T-RSV-04', 'NFR-SEC-03', 'Pembatalan pendaftaran milik akun lain ditolak', '404', String(r.status), r.status === 404);
  r = await api().get('/api/v1/registrations/me').set(bearer(winner));
  rec('T-RSV-05', 'FR-RSV-05', 'Riwayat pendaftaran menampilkan event yang didaftari', 'total >= 1', String(r.body.total), r.body.total >= 1);
  r = await api().delete(`/api/v1/registrations/${regId}`).set(bearer(winner));
  rec('T-RSV-06', 'FR-RSV-04', 'Pembatalan oleh pemilik sebelum event dimulai', '200', String(r.status), r.status === 200);
  r = await api().delete(`/api/v1/registrations/${regId}`).set(bearer(winner));
  rec('T-RSV-07', 'FR-RSV-04', 'Pembatalan ulang ditolak (kursi tidak dikembalikan dua kali)', '409', String(r.status), r.status === 409);
  r = await api().post(`/api/v1/events/${evQuota}/registrations`).set(bearer(loser));
  rec('T-RSV-08', 'FR-RSV-04', 'Setelah pembatalan, kursi bisa dipakai pendaftar lain', '201', String(r.status), r.status === 201);
  const row = (await pool.query('SELECT reserved_seats, quota FROM events WHERE id=$1', [evQuota])).rows[0];
  rec('T-RSV-09', 'FR-RSV-02', 'Penghitung kursi konsisten (0 <= reserved <= quota)', 'reserved=1, quota=1', JSON.stringify(row), Number(row.reserved_seats) === 1 && Number(row.quota) === 1);
  r = await api().post(`/api/v1/events/00000000-0000-4000-8000-000000000000/registrations`).set(bearer(stu));
  rec('T-RSV-10', 'FR-RSV-01', 'RSVP ke event yang tidak ada -> 404', '404', String(r.status), r.status === 404);
});

test('PESERTA & CSV', async () => {
  let r = await api().get(`/api/v1/organizer/events/${evQuota}/participants`).set(bearer(org1));
  rec('T-DSH-01', 'FR-DSH-03', 'Penyelenggara melihat daftar peserta eventnya', 'total=1', String(r.body.total), r.body.total === 1);
  r = await api().get(`/api/v1/organizer/events/${evQuota}/participants`).set(bearer(org2));
  rec('T-DSH-02', 'FR-DSH-04', 'Penyelenggara organisasi lain tidak boleh melihat peserta', '404', String(r.status), r.status === 404);
  r = await api().get(`/api/v1/organizer/events/${evQuota}/participants`).query({ format: 'csv' }).set(bearer(org1));
  rec('T-DSH-03', 'FR-DSH-04', 'Ekspor CSV peserta', 'CSV berisi header + 1 baris', JSON.stringify(r.body.csv).slice(0, 120), r.status === 200 && r.body.csv?.split('\r\n').filter(Boolean).length === 2);
  r = await api().get('/api/v1/organizer/statistics').set(bearer(org1));
  rec('T-DSH-04', 'FR-DSH-02', 'Statistik penyelenggara dapat diakses', '200', String(r.status), r.status === 200);
  r = await api().get('/api/v1/admin/statistics').set(bearer(admin));
  rec('T-ADM-01', 'FR-ADM-04', 'Statistik admin dapat diakses', '200', String(r.status), r.status === 200);
  r = await api().post('/api/v1/admin/categories').set(bearer(admin)).send({ name: 'Workshop' });
  rec('T-ADM-02', 'FR-ADM-01', 'Kategori duplikat ditolak', '409', String(r.status), r.status === 409);
  r = await api().post('/api/v1/admin/organizations').set(bearer(admin)).send({ name: 'Himpunan Z' });
  const oid = r.body.organizationId ?? r.body.id;
  r = await api().patch(`/api/v1/admin/organizations/${oid}`).set(bearer(admin)).send({ status: 'verified' });
  rec('T-ADM-03', 'FR-ADM-02', 'Admin membuat & memverifikasi organisasi', '200 verified', `${r.status} ${r.body.status}`, r.status === 200 && r.body.status === 'verified');
});
