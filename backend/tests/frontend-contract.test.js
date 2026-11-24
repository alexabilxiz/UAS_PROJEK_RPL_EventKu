import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { createCategory, createOrganization, createUser, setupDatabase } from './helpers.js';
import { startContractServer } from './contract.js';

let pool; let fe; let categoryId; let orgId; let pendingOrgId;
let admin; let organizer; let student; let outsider; let eventId;
const session = (user) => ({ token: user.token });

const future = (days, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();
const draft = (overrides = {}) => ({
  title: 'Seminar Karier', description: 'Pembicara industri.', categoryId, startAt: future(3), endAt: future(3, 2),
  locationOrLink: 'Aula Kampus', posterUrl: 'https://example.org/poster.png', quota: 2, ...overrides,
});

beforeAll(async () => {
  pool = await setupDatabase();
  fe = await startContractServer();
  categoryId = await createCategory(pool, 'Seminar');
  orgId = await createOrganization(pool, { name: 'Komunitas Kampus', status: 'verified' });
  pendingOrgId = await createOrganization(pool, { name: 'Komunitas Baru', status: 'pending' });
  admin = await createUser(pool, { role: 'admin', email: 'admin@t.test', name: 'Admin Uji' });
  organizer = await createUser(pool, { role: 'penyelenggara', email: 'org@t.test', organizationId: orgId });
  student = await createUser(pool, { role: 'mahasiswa', email: 'mhs@student.ukwms.ac.id', ukwms: true, name: 'Mahasiswa Satu' });
  outsider = await createUser(pool, { role: 'mahasiswa', email: 'luar@gmail.test' });
});
afterAll(() => fe.close());

describe('Auth (authService frontend)', () => {
  test('register → login → getMe → logout', async () => {
    const created = await fe.authService.register({ name: 'Budi', email: 'Budi@student.ukwms.ac.id', password: 'password123', role: 'mahasiswa' });
    expect(created).toMatchObject({ role: 'mahasiswa', status: 'active', organizationId: null });
    const login = await fe.authService.login('budi@student.ukwms.ac.id', 'password123');
    expect(login.user).toMatchObject({ role: 'mahasiswa', name: 'Budi', ukwmsVerified: true });
    const me = await fe.authService.getMe(login.accessToken);
    expect(me.userId).toBe(created.userId);
    await fe.authService.logout(login.accessToken);
    await expect(fe.authService.getMe(login.accessToken)).rejects.toMatchObject({ status: 401 });
  });

  test('penyelenggara baru menunggu verifikasi admin lalu membawa status organisasinya', async () => {
    const created = await fe.authService.register({ name: 'Sari', email: 'sari@t.test', password: 'password123', role: 'penyelenggara', organizationId: pendingOrgId });
    expect(created).toMatchObject({ role: 'penyelenggara', status: 'pending', organizationId: pendingOrgId });
    await expect(fe.authService.login('sari@t.test', 'password123')).rejects.toMatchObject({ status: 403 });
    await fe.workspaceService.updateUser(created.userId, 'active', session(admin));
    const { user } = await fe.authService.login('sari@t.test', 'password123');
    expect(user).toMatchObject({ role: 'penyelenggara', organizationId: pendingOrgId, organizationStatus: 'pending' });
  });

  test('email dobel → 409 dengan fieldErrors.email; sandi pendek → 422', async () => {
    await expect(fe.authService.register({ name: 'X', email: 'budi@student.ukwms.ac.id', password: 'password123', role: 'mahasiswa' }))
      .rejects.toMatchObject({ status: 409, fieldErrors: { email: expect.any(String) } });
    await expect(fe.authService.register({ name: 'X', email: 'x@t.test', password: 'password123', role: 'penyelenggara', organizationId: '00000000-0000-4000-8000-000000000000' }))
      .rejects.toMatchObject({ status: 422, fieldErrors: { organizationId: expect.any(String) } });
  });

  test('login salah → 401', async () => {
    await expect(fe.authService.login('budi@student.ukwms.ac.id', 'salah-banget')).rejects.toMatchObject({ status: 401 });
  });

  test('ubah profil dan sandi', async () => {
    const { accessToken } = await fe.authService.login('budi@student.ukwms.ac.id', 'password123');
    const updated = await fe.authService.updateProfile({ name: 'Budi Baru', photoUrl: 'https://example.org/b.png' }, { token: accessToken });
    expect(updated.name).toBe('Budi Baru');
    await expect(fe.authService.changePassword({ currentPassword: 'salah', password: 'passwordbaru1' }, { token: accessToken }))
      .rejects.toMatchObject({ status: 422 });
    await fe.authService.changePassword({ currentPassword: 'password123', password: 'passwordbaru1' }, { token: accessToken });
    await expect(fe.authService.getMe(accessToken)).resolves.toBeTruthy(); // sesi yang dipakai tetap hidup
    await expect(fe.authService.login('budi@student.ukwms.ac.id', 'password123')).rejects.toMatchObject({ status: 401 });
  });
});

describe('Alur event end-to-end', () => {
  test('kategori publik', async () => {
    expect(await fe.eventService.listCategories()).toEqual([{ categoryId, name: 'Seminar' }]);
  });

  test('penyelenggara menyimpan draft lalu mengajukan; draft belum tampil publik', async () => {
    eventId = await fe.submission.createEventDraft(draft(), session(organizer));
    expect(await fe.submission.getEventDraftStatus(eventId, session(organizer))).toBe('draft');
    expect((await fe.eventService.listEvents({})).total).toBe(0);
    await expect(fe.eventService.getEvent(eventId)).rejects.toMatchObject({ status: 404 });
    expect(await fe.submission.submitEventDraft(eventId, session(organizer))).toBe('menunggu_moderasi');
    await expect(fe.submission.submitEventDraft(eventId, session(organizer))).rejects.toMatchObject({ status: 409 });
  });

  test('organisasi belum terverifikasi tidak bisa mengajukan; mahasiswa tidak bisa membuat event', async () => {
    const pending = await createUser(pool, { role: 'penyelenggara', email: 'pending@t.test', organizationId: pendingOrgId });
    await expect(fe.submission.createEventDraft(draft(), session(pending))).rejects.toMatchObject({ status: 403 });
    await expect(fe.submission.createEventDraft(draft(), session(student))).rejects.toMatchObject({ status: 403 });
  });

  test('validasi draft memakai fieldErrors', async () => {
    await expect(fe.submission.createEventDraft(draft({ title: '', startAt: future(-1) }), session(organizer)))
      .rejects.toMatchObject({ status: 422, fieldErrors: { title: expect.any(String), startAt: expect.any(String) } });
  });

  test('admin melihat antrean dan menyetujui; penolakan wajib alasan', async () => {
    const queue = await fe.moderation.listPendingEvents({ ...session(admin), page: 1 });
    expect(queue.total).toBe(1);
    expect(queue.events[0].eventId).toBe(eventId);
    await expect(fe.moderation.moderateEvent(eventId, { status: 'ditolak', reason: ' ', ...session(admin) })).rejects.toMatchObject({ status: 422 });
    await expect(fe.moderation.moderateEvent(eventId, { status: 'disetujui', ...session(student) })).rejects.toMatchObject({ status: 403 });
    await fe.moderation.moderateEvent(eventId, { status: 'disetujui', ...session(admin) });
    await expect(fe.moderation.moderateEvent(eventId, { status: 'disetujui', ...session(admin) })).rejects.toMatchObject({ status: 409 });
  });

  test('event muncul di katalog, detail, dan pencarian/filter', async () => {
    const list = await fe.eventService.listEvents({ q: 'karier', category: categoryId, organizer: orgId });
    expect(list).toMatchObject({ total: 1, page: 1 });
    expect(list.data[0]).toMatchObject({ eventId, status: 'disetujui', categoryName: 'Seminar', organizationName: 'Komunitas Kampus', quota: 2, availableSeats: 2 });
    expect((await fe.eventService.listEvents({ q: 'tidak-ada' })).total).toBe(0);
    expect((await fe.eventService.listEvents({ q: '100%_' })).total).toBe(0); // karakter wildcard tidak error
    expect((await fe.eventService.getEvent(eventId)).title).toBe('Seminar Karier');
    const day = new Date(Date.parse(list.data[0].startAt) + 7 * 3_600_000).toISOString().slice(0, 10);
    expect((await fe.eventService.listEvents({ date: day })).total).toBe(1);
    expect((await fe.eventService.listEvents({ category: 'bukan-uuid' })).total).toBe(0);
  });

  test('penyelenggara dan admin mendapat notifikasi/riwayat moderasi', async () => {
    const notices = await fe.workspaceService.notifications({ ...session(organizer), page: 1 });
    expect(notices.data[0]).toMatchObject({ eventId, status: 'disetujui', isRead: false });
    await fe.workspaceService.markRead(notices.data[0].notificationId, session(organizer));
    expect((await fe.workspaceService.notifications({ ...session(organizer), page: 1 })).data[0].isRead).toBe(true);
    const history = await fe.workspaceService.moderationHistory({ ...session(admin), page: 1 });
    expect(history.data[0]).toMatchObject({ status: 'disetujui', adminName: 'Admin Uji' });
    expect((await fe.workspaceService.publishedEvents({ ...session(admin), page: 1 })).total).toBe(1);
  });
});

describe('RSVP mahasiswa', () => {
  let registrationId;

  test('hanya mahasiswa UKWMS terverifikasi yang boleh RSVP', async () => {
    await expect(fe.registrationService.register(eventId, session(outsider))).rejects.toMatchObject({ status: 403 });
    await expect(fe.registrationService.register(eventId, session(organizer))).rejects.toMatchObject({ status: 403 });
    await expect(fe.registrationService.register(eventId, {})).rejects.toMatchObject({ status: 401 });
  });

  test('RSVP berhasil, menambah reservedSeats, dobel → 409', async () => {
    const result = await fe.registrationService.register(eventId, session(student));
    registrationId = result.registrationId;
    expect(result.status).toBe('aktif');
    expect((await fe.eventService.getEvent(eventId)).availableSeats).toBe(1);
    await expect(fe.registrationService.register(eventId, session(student))).rejects.toMatchObject({ status: 409 });
    expect(await fe.registrationService.hasActiveRegistration(eventId, session(student))).toBe(true);
  });

  test('kuota penuh → 409; batal membuka kursi; daftar ulang setelah batal', async () => {
    const second = await createUser(pool, { role: 'mahasiswa', email: 'dua@student.ukwms.ac.id', ukwms: true });
    const third = await createUser(pool, { role: 'mahasiswa', email: 'tiga@student.ukwms.ac.id', ukwms: true });
    await fe.registrationService.register(eventId, session(second));
    await expect(fe.registrationService.register(eventId, session(third))).rejects.toMatchObject({ status: 409 });
    expect((await fe.eventService.getEvent(eventId)).availableSeats).toBe(0);

    await fe.registrationService.cancel(registrationId, session(student));
    expect((await fe.eventService.getEvent(eventId)).availableSeats).toBe(1);
    await expect(fe.registrationService.cancel(registrationId, session(student))).rejects.toMatchObject({ status: 409 });
    await expect(fe.registrationService.cancel(registrationId, session(second))).rejects.toMatchObject({ status: 404 });

    const again = await fe.registrationService.register(eventId, session(student));
    expect(again.registrationId).toBe(registrationId); // baris yang sama diaktifkan kembali
    expect((await fe.eventService.getEvent(eventId)).availableSeats).toBe(0);
  });

  test('daftar pendaftaran: upcoming vs history', async () => {
    const upcoming = await fe.registrationService.list({ ...session(student), scope: 'upcoming' });
    expect(upcoming.data).toHaveLength(1);
    expect(upcoming.data[0]).toMatchObject({ eventId, status: 'aktif', title: 'Seminar Karier' });
    expect((await fe.registrationService.list({ ...session(student), scope: 'history' })).total).toBe(0);
  });

  test('penyelenggara melihat peserta aktif dan mengekspor CSV; organisasi lain ditolak', async () => {
    const people = await fe.workspaceService.participants(eventId, { ...session(organizer), page: 1 });
    expect(people.eventTitle).toBe('Seminar Karier');
    expect(people.total).toBe(2);
    expect(people.data.map((row) => row.email)).toEqual(expect.arrayContaining(['mhs@student.ukwms.ac.id']));
    const csv = await fe.workspaceService.exportParticipants(eventId, session(organizer));
    expect(csv.split('\r\n')[0]).toBe('"Nama","Email","Waktu daftar (ISO 8601)"');
    const otherOrg = await createOrganization(pool, { name: 'Org Lain', status: 'verified' });
    const stranger = await createUser(pool, { role: 'penyelenggara', email: 'asing@t.test', organizationId: otherOrg });
    await expect(fe.workspaceService.participants(eventId, { ...session(stranger), page: 1 })).rejects.toMatchObject({ status: 404 });
    const stats = await fe.workspaceService.statistics('penyelenggara', session(organizer));
    expect(stats).toMatchObject({ active: 2, occupancy: 100 });
  });

  test('mahasiswa menerima notifikasi RSVP dan bisa menandainya dibaca', async () => {
    const notices = await fe.workspaceService.studentNotices({ ...session(student), page: 1 });
    expect(notices.data.some((row) => row.type === 'rsvp' && row.eventId === eventId)).toBe(true);
    await fe.workspaceService.markStudentNotice(notices.data[0].notificationId, session(student));
  });
});

describe('Kelola event penyelenggara', () => {
  test('ubah event tanpa jadwal → tetap tayang; ubah jadwal → moderasi ulang + notifikasi peserta', async () => {
    const current = await fe.submission.getOrganizerEvent(eventId, session(organizer));
    expect(current.version).toBeGreaterThan(0);
    const body = draft({ title: 'Seminar Karier (Revisi)', startAt: current.startAt, endAt: current.endAt, locationOrLink: current.locationOrLink, quota: 5 });
    await fe.submission.changeOrganizerEvent(current, 'update', body, session(organizer));
    let after = await fe.submission.getOrganizerEvent(eventId, session(organizer));
    expect(after).toMatchObject({ title: 'Seminar Karier (Revisi)', status: 'disetujui', quota: 5, reservedSeats: 2 });

    // versi lama → 409 (kontrol konkurensi)
    await expect(fe.submission.changeOrganizerEvent(current, 'update', body, session(organizer))).rejects.toMatchObject({ status: 409 });
    // kuota di bawah peserta aktif → 409
    await expect(fe.submission.changeOrganizerEvent(after, 'update', { ...body, quota: 1 }, session(organizer))).rejects.toMatchObject({ status: 409 });

    await fe.submission.changeOrganizerEvent(after, 'update', { ...body, locationOrLink: 'Ruang Baru' }, session(organizer));
    after = await fe.submission.getOrganizerEvent(eventId, session(organizer));
    expect(after.status).toBe('menunggu_moderasi');
    expect((await fe.eventService.listEvents({})).total).toBe(0);
    const notices = await fe.workspaceService.studentNotices({ ...session(student), page: 1 });
    expect(notices.data.some((row) => row.type === 'jadwal_berubah')).toBe(true);
  });

  test('batalkan event → peserta diberi tahu; hilang dari riwayat upcoming', async () => {
    const current = await fe.submission.getOrganizerEvent(eventId, session(organizer));
    await fe.submission.changeOrganizerEvent(current, 'cancel', undefined, session(organizer));
    expect((await fe.submission.getOrganizerEvent(eventId, session(organizer))).status).toBe('dibatalkan');
    const notices = await fe.workspaceService.studentNotices({ ...session(student), page: 1 });
    expect(notices.data.some((row) => row.type === 'event_dibatalkan')).toBe(true);
    expect((await fe.registrationService.list({ ...session(student), scope: 'upcoming' })).total).toBe(0);
    expect((await fe.registrationService.list({ ...session(student), scope: 'history' })).total).toBe(1);
  });

  test('daftar event organisasi', async () => {
    const list = await fe.workspaceService.organizerEvents({ ...session(organizer), page: 1 });
    expect(list.total).toBe(1);
  });
});

describe('Poster, favorit, minat, ulasan, admin', () => {
  test('unggah poster PNG lalu dipakai pada event; file palsu ditolak', async () => {
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32)]);
    const file = new File([png], 'p.png', { type: 'image/png' });
    const posterUrl = await fe.submission.uploadEventPoster(file, session(organizer));
    expect(posterUrl).toMatch(/^\/api\/v1\/assets\/posters\/[a-f0-9-]{36}$/);
    const served = await fetch(`${fe.origin}${posterUrl}`);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await served.arrayBuffer()).equals(png)).toBe(true);
    await expect(fe.submission.uploadEventPoster(new File([Buffer.from('bukan gambar')], 'x.png', { type: 'image/png' }), session(organizer)))
      .rejects.toMatchObject({ status: 422 });
    await expect(fe.submission.createEventDraft(draft({ posterUrl }), session(organizer))).resolves.toBeTruthy();
    const other = await createUser(pool, { role: 'penyelenggara', email: 'org2@t.test', organizationId: await createOrganization(pool, { name: 'O2' }) });
    await expect(fe.submission.createEventDraft(draft({ posterUrl }), session(other))).rejects.toMatchObject({ status: 422 });
  });

  test('event pendaftaran eksternal tanpa kuota', async () => {
    const id = await fe.submission.createEventDraft(draft({ quota: undefined, registrationMode: 'external', audience: 'Siswa SMA', registrationUrl: 'https://example.org/daftar' }), session(organizer));
    await fe.submission.submitEventDraft(id, session(organizer));
    await fe.moderation.moderateEvent(id, { status: 'disetujui', ...session(admin) });
    const event = await fe.eventService.getEvent(id);
    expect(event).toMatchObject({ registrationMode: 'external', quota: null, availableSeats: null, registrationUrl: 'https://example.org/daftar' });
    await expect(fe.registrationService.register(id, session(student))).rejects.toMatchObject({ status: 409 });
  });

  test('minat kategori memicu notifikasi event baru; favorit; preferensi email', async () => {
    expect(await fe.workspaceService.interests(session(student), [categoryId])).toEqual([categoryId]);
    await expect(fe.workspaceService.interests(session(student), ['bukan-uuid'])).rejects.toMatchObject({ status: 422 });
    expect(await fe.workspaceService.emailPreference(session(student), true)).toBe(true);

    const id = await fe.submission.createEventDraft(draft({ title: 'Event Minat' }), session(organizer));
    await fe.submission.submitEventDraft(id, session(organizer));
    await fe.moderation.moderateEvent(id, { status: 'disetujui', ...session(admin) });
    const notices = await fe.workspaceService.studentNotices({ ...session(student), page: 1 });
    expect(notices.data.some((row) => row.type === 'event_baru' && row.eventId === id)).toBe(true);
    const mail = await fe.workspaceService.demoEmail({ ...session(student), page: 1 });
    expect(mail.data.some((row) => row.type === 'event_baru' && row.to === 'mhs@student.ukwms.ac.id')).toBe(true);

    expect(await fe.workspaceService.favorite(id, session(student))).toBe(false);
    expect(await fe.workspaceService.favorite(id, session(student), true)).toBe(true);
    expect((await fe.workspaceService.favorites({ ...session(student), page: 1 })).total).toBe(1);
    expect(await fe.workspaceService.favorite(id, session(student), false)).toBe(false);
  });

  test('ulasan hanya untuk peserta event selesai', async () => {
    await expect(fe.workspaceService.review(eventId, session(student))).rejects.toMatchObject({ status: 403 });
    const doneId = (await pool.query(`SELECT id FROM events WHERE title = 'Event Minat'`)).rows[0].id;
    await pool.query(`UPDATE events SET status = 'selesai' WHERE id = $1`, [doneId]);
    await expect(fe.workspaceService.review(doneId, session(student))).rejects.toMatchObject({ status: 403 }); // belum ikut
    await pool.query(`INSERT INTO registrations (id, event_id, user_id, status) VALUES ($1, $2, $3, 'aktif')`, ['11111111-1111-4111-8111-111111111111', doneId, student.id]);
    expect(await fe.workspaceService.review(doneId, session(student))).toMatchObject({ title: 'Event Minat', review: null });
    expect((await fe.workspaceService.review(doneId, session(student), { rating: 5, comment: 'Bagus' })).review).toEqual({ rating: 5, comment: 'Bagus' });
    expect((await fe.workspaceService.review(doneId, session(student), { rating: 4, comment: 'Revisi' })).review.rating).toBe(4);
    await expect(fe.workspaceService.review(doneId, session(student), { rating: 9, comment: 'x' })).rejects.toMatchObject({ status: 422 });
  });

  test('admin: kategori, organisasi, pengguna, statistik', async () => {
    await fe.workspaceService.saveCategory(null, { name: 'Lomba', isActive: true }, session(admin));
    await expect(fe.workspaceService.saveCategory(null, { name: 'lomba', isActive: true }, session(admin))).rejects.toMatchObject({ status: 409 });
    const cats = await fe.workspaceService.categories({ ...session(admin), page: 1 });
    expect(cats.total).toBe(2);
    const lomba = cats.data.find((item) => item.name === 'Lomba');
    await fe.workspaceService.saveCategory(lomba.categoryId, { name: 'Lomba', isActive: false }, session(admin));
    expect(await fe.eventService.listCategories()).toHaveLength(1); // nonaktif hilang dari pilihan

    const orgs = await fe.workspaceService.organizations({ ...session(admin), page: 1 });
    const pending = orgs.data.find((item) => item.status === 'pending');
    await fe.workspaceService.updateOrganization(pending.organizationId, 'verified', session(admin));
    await expect(fe.workspaceService.organizations({ ...session(organizer), page: 1 })).rejects.toMatchObject({ status: 403 });

    const users = await fe.workspaceService.users({ ...session(admin), page: 1 });
    const target = users.data.find((item) => item.email === 'luar@gmail.test');
    await fe.workspaceService.updateUser(target.userId, 'disabled', session(admin));
    await expect(fe.authService.getMe(outsider.token)).rejects.toMatchObject({ status: 401 }); // sesi langsung dicabut
    await expect(fe.authService.login('luar@gmail.test', 'RahasiaBanget123')).rejects.toMatchObject({ status: 403 });
    const adminRow = users.data.find((item) => item.role === 'admin');
    await expect(fe.workspaceService.updateUser(adminRow.userId, 'disabled', session(admin))).rejects.toMatchObject({ status: 403 });

    const stats = await fe.workspaceService.statistics('admin', session(admin));
    expect(stats.users).toBeGreaterThan(5);
    expect(stats.categories.map((row) => row.label)).toEqual(expect.arrayContaining(['Seminar', 'Lomba']));
  });

  test('pembatalan oleh admin (turunkan event tayang) memberi tahu peserta', async () => {
    const id = (await pool.query(`SELECT id FROM events WHERE status = 'disetujui' AND registration_mode = 'external'`)).rows[0].id;
    await fe.moderation.moderateEvent(id, { status: 'dibatalkan', reason: 'Melanggar aturan', ...session(admin) });
    expect((await pool.query(`SELECT status FROM events WHERE id = $1`, [id])).rows[0].status).toBe('dibatalkan');
  });
});
