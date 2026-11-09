import { expect, test } from '@playwright/test';

const student = { userId: 'student-12', name: 'Mahasiswa Kampus', role: 'mahasiswa', status: 'active' };
const organizer = {
  userId: 'organizer-12', name: 'Panitia Kampus', role: 'penyelenggara', status: 'active',
  organization: { organizationId: 'org-12', status: 'verified' },
};
const event = {
  eventId: 'event-12', title: 'Workshop Desain Produk', description: 'Latihan merancang produk bersama komunitas kampus.',
  categoryId: 'workshop', categoryName: 'Workshop', organizationId: 'org-12', organizationName: 'Panitia Kampus',
  startAt: '2035-11-18T02:00:00.000Z', endAt: '2035-11-18T05:00:00.000Z',
  locationOrLink: 'Aula Kampus Pakuwon', quota: 30, reservedSeats: 3, availableSeats: 27, status: 'disetujui',
};
const token = 'week12-fixture-only';
const headers = `Bearer ${token}`;
const proposal = {
  title: 'Workshop Fotografi', description: 'Praktik komposisi dan pencahayaan bersama panitia kampus.',
  categoryId: 'workshop', startAt: '2035-11-22T02:00:00.000Z', endAt: '2035-11-22T05:00:00.000Z',
  locationOrLink: 'Aula Kampus Pakuwon', posterUrl: 'https://example.test/poster.png', quota: 40,
};

async function mockEventApi(page, { user = student, submissionFails = false, registrationConflict = false } = {}) {
  const calls = [];
  let registrationStatus = null;
  let submitAttempts = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    calls.push({
      method, path, query: Object.fromEntries(url.searchParams),
      body: request.postDataJSON(), auth: request.headers().authorization,
    });
    const reply = (json, status = 200) => route.fulfill({ status, json });
    if (path === '/auth/login') return reply({ accessToken: token, user });
    if (path === '/auth/me') return reply(user);
    if (path === '/categories') return reply({ data: [{ categoryId: 'workshop', name: 'Workshop' }] });
    if (path === '/events' && method === 'GET') {
      const current = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      if (url.searchParams.get('q') === 'tidak ditemukan') return reply({ data: [], page: current, total: 0 });
      if (current === 2) {
        return reply({ data: [{ ...event, eventId: 'event-13', title: 'Workshop Fotografi Kampus' }], page: 2, total: limit + 1 });
      }
      return reply({ data: [event], page: 1, total: limit + 1 });
    }
    if (path === '/events/event-12' && method === 'GET') return reply({ event });
    if (path === '/events' && method === 'POST') return reply({ eventId: 'draft-12', status: 'draft' }, 201);
    if (path === '/events/draft-12/submit' && method === 'PATCH') {
      submitAttempts += 1;
      if (submissionFails && submitAttempts === 1) return reply({ message: 'Fixture temporary failure' }, 503);
      return reply({ status: 'menunggu_moderasi' });
    }
    if (path === '/events/event-12/registrations' && method === 'POST') {
      if (registrationConflict) return reply({ message: 'Fixture quota conflict' }, 409);
      registrationStatus = 'aktif';
      return reply({ registrationId: 'reg-12', status: registrationStatus }, 201);
    }
    if (path === '/registrations/me' && method === 'GET') {
      const scope = url.searchParams.get('scope');
      const rows = (scope === 'upcoming' && registrationStatus === 'aktif') ||
        (scope === 'history' && registrationStatus === 'dibatalkan')
        ? [{ registrationId: 'reg-12', eventId: event.eventId, status: registrationStatus, event }]
        : [];
      return reply({ data: rows, page: 1, total: rows.length });
    }
    if (path === '/registrations/reg-12' && method === 'DELETE') {
      registrationStatus = 'dibatalkan';
      return reply({ message: 'Pendaftaran dibatalkan.' });
    }
    return reply({ message: 'Endpoint tidak tersedia pada fixture.' }, 404);
  });
  return calls;
}

async function login(page) {
  await page.getByLabel('Email', { exact: true }).fill('kampus@example.test');
  await page.getByLabel('Kata sandi', { exact: true }).fill('Password123!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

async function startAuthenticated(page, path) {
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('eventku.auth.token')) sessionStorage.setItem('eventku.auth.token', value);
  }, token);
  await page.goto(path);
}

async function fillProposal(page) {
  await page.getByLabel('Judul event', { exact: true }).fill(proposal.title);
  await page.getByLabel('Deskripsi', { exact: true }).fill(proposal.description);
  await page.getByLabel('Kategori', { exact: true }).selectOption(proposal.categoryId);
  await page.getByLabel('Mulai (WIB)', { exact: true }).fill('2035-11-22T09:00');
  await page.getByLabel('Selesai (WIB)', { exact: true }).fill('2035-11-22T12:00');
  await page.getByLabel('Lokasi atau tautan', { exact: true }).fill(proposal.locationOrLink);
  await page.getByLabel('URL poster', { exact: true }).fill(proposal.posterUrl);
  await page.getByLabel('Kuota peserta', { exact: true }).fill(String(proposal.quota));
}

test('public filters and pagination send API query, preserve URL, and open event detail', async ({ page }, testInfo) => {
  const calls = await mockEventApi(page);
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: event.title })).toBeVisible();
  await page.getByLabel('Cari event', { exact: true }).fill('workshop');
  await page.getByLabel('Kategori', { exact: true }).selectOption('workshop');
  await page.getByLabel('ID penyelenggara', { exact: true }).fill('org-12');
  await page.getByLabel('Tanggal event', { exact: true }).fill('2035-11-18');
  await page.getByRole('button', { name: 'Cari Event', exact: true }).click();
  await expect.poll(() => calls.find(({ path, query }) => path === '/events' && query.q === 'workshop')?.query)
    .toMatchObject({ q: 'workshop', category: 'workshop', organizer: 'org-12', date: '2035-11-18', page: '1' });
  await expect(page).toHaveURL(/category=workshop/);
  await expect(page.getByRole('heading', { name: event.title })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('katalog-event.png'), fullPage: true });
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await expect(page.getByRole('heading', { name: 'Workshop Fotografi Kampus' })).toBeVisible();
  await expect.poll(() => calls.find(({ query }) => query.page === '2')?.query.category).toBe('workshop');
  await page.getByRole('button', { name: 'Sebelumnya' }).click();
  await expect(page.getByRole('heading', { name: event.title })).toBeVisible();
  await page.getByRole('link', { name: /lihat detail/i }).first().click();
  await expect(page).toHaveURL(/\/events\/event-12$/);
  await expect(page.getByRole('heading', { name: event.title })).toBeVisible();
  expect(calls.filter(({ path }) => path.startsWith('/events')).every(({ auth }) => auth === undefined)).toBe(true);
});

test('empty catalog is reachable on mobile without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await mockEventApi(page);
  await page.goto('/events?q=tidak+ditemukan');
  await expect(page.getByRole('heading', { name: 'Event tidak ditemukan' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('date range includes the final WIB day and survives reloading the catalog URL', async ({ page }) => {
  const calls = await mockEventApi(page);
  await page.goto('/events?date=2035-11-18');
  await page.getByLabel('Gunakan rentang tanggal', { exact: true }).check();
  await page.getByLabel('Dari tanggal', { exact: true }).fill('2035-11-18');
  await page.getByLabel('Sampai tanggal', { exact: true }).fill('2035-11-30');
  await page.getByRole('button', { name: 'Cari Event', exact: true }).click();
  await expect.poll(() => calls.find(({ path, query }) => path === '/events' && query.from)?.query)
    .toMatchObject({ from: '2035-11-18T00:00:00+07:00', to: '2035-12-01T00:00:00+07:00' });
  expect(calls.find(({ query }) => query.from).query).not.toHaveProperty('date');
  await page.reload();
  await expect(page.getByLabel('Dari tanggal', { exact: true })).toHaveValue('2035-11-18');
  await expect(page.getByLabel('Sampai tanggal', { exact: true })).toHaveValue('2035-11-30');
});

test('student returns to the event after login, RSVPs and cancels their registration', async ({ page }, testInfo) => {
  const calls = await mockEventApi(page);
  await page.goto('/events/event-12');
  await page.getByRole('link', { name: 'Masuk untuk mendaftar' }).click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await login(page);
  await expect(page).toHaveURL(/\/events\/event-12$/);
  await page.getByRole('button', { name: 'Daftar Event', exact: true }).click();
  await expect(page.getByText(/pendaftaran berhasil/i)).toBeVisible();
  expect(calls.find(({ method, path }) => method === 'POST' && path.endsWith('/registrations')))
    .toMatchObject({ auth: headers, body: null });
  await page.screenshot({ path: testInfo.outputPath('rsvp-event.png'), fullPage: true });
  await page.goto('/mahasiswa/pendaftaran');
  await expect(page.getByText(event.title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Batalkan pendaftaran', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, batalkan', exact: true }).click();
  await expect.poll(() => calls.find(({ method }) => method === 'DELETE')?.path).toBe('/registrations/reg-12');
  expect(calls.find(({ method }) => method === 'DELETE')).toMatchObject({ auth: headers, body: null });
  await page.getByRole('button', { name: 'Riwayat', exact: true }).click();
  await expect(page.getByText(event.title, { exact: true })).toBeVisible();
  await expect(page.getByText('Dibatalkan', { exact: true })).toBeVisible();
});

test('RSVP conflict reports failure and keeps the student session', async ({ page }) => {
  const calls = await mockEventApi(page, { registrationConflict: true });
  await startAuthenticated(page, '/events/event-12');
  await page.getByRole('button', { name: 'Daftar Event', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/kuota|konflik|terdaftar/i);
  await expect(page.getByText(/pendaftaran berhasil/i)).toHaveCount(0);
  expect(calls.filter(({ path, method }) => method === 'POST' && path.endsWith('/registrations'))).toHaveLength(1);
  await expect(page.getByRole('link', { name: 'Akun saya' })).toBeVisible();
});

test('verified organizer resumes a saved draft after submission failure without duplicating POST', async ({ page }, testInfo) => {
  const calls = await mockEventApi(page, { user: organizer, submissionFails: true });
  await startAuthenticated(page, '/penyelenggara/event/ajukan');
  await fillProposal(page);
  await page.screenshot({ path: testInfo.outputPath('pengajuan-event.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ajukan event', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lanjutkan pengajuan', exact: true })).toBeEnabled();
  expect(calls.find(({ method, path }) => method === 'POST' && path === '/events'))
    .toMatchObject({ auth: headers, body: proposal });
  await page.reload();
  await page.getByRole('button', { name: 'Lanjutkan pengajuan', exact: true }).click();
  await expect(page.getByText('Menunggu Moderasi', { exact: true })).toBeVisible();
  expect(calls.filter(({ method, path }) => method === 'POST' && path === '/events')).toHaveLength(1);
  const patches = calls.filter(({ method }) => method === 'PATCH');
  expect(patches).toHaveLength(2);
  for (const patch of patches) {
    expect(patch).toMatchObject({ path: '/events/draft-12/submit', auth: headers, body: null });
  }
});

test('saving a draft postpones moderation until the organizer continues', async ({ page }) => {
  const calls = await mockEventApi(page, { user: organizer });
  await startAuthenticated(page, '/penyelenggara/event/ajukan');
  await fillProposal(page);
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Draft tersimpan', exact: true })).toBeVisible();
  expect(calls.filter(({ method }) => method === 'PATCH')).toHaveLength(0);
  await page.reload();
  await page.getByRole('button', { name: 'Lanjutkan pengajuan', exact: true }).click();
  await expect(page.getByText('Menunggu Moderasi', { exact: true })).toBeVisible();
  expect(calls.filter(({ method, path }) => method === 'POST' && path === '/events')).toHaveLength(1);
  expect(calls.filter(({ method }) => method === 'PATCH')).toHaveLength(1);
});

test('organizer route is guarded for students and blocks unverified organizations', async ({ page }) => {
  const studentCalls = await mockEventApi(page);
  await startAuthenticated(page, '/penyelenggara/event/ajukan');
  await expect(page.getByRole('heading', { name: 'Akses terbatas' })).toBeVisible();
  expect(studentCalls.filter(({ path }) => path === '/events')).toHaveLength(0);

  await page.unroute('**/api/v1/**');
  const pendingCalls = await mockEventApi(page, { user: { ...organizer, organization: { organizationId: 'org-12', status: 'pending' } } });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Organisasi perlu diverifikasi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajukan event', exact: true })).toHaveCount(0);
  expect(pendingCalls.filter(({ path }) => path === '/events')).toHaveLength(0);
});
