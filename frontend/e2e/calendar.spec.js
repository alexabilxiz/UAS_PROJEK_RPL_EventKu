import { expect, test } from '@playwright/test';

const event = {
  eventId: 'calendar-event', title: 'Workshop Kalender Kampus', categoryName: 'Workshop',
  organizationName: 'Panitia Kampus', startAt: '2035-10-31T17:30:00Z', endAt: '2035-11-01T03:00:00Z',
  description: 'Kegiatan kampus untuk menguji batas tanggal WIB.', status: 'disetujui', quota: 30,
};

async function fixture(page, { failUntilRetry = false, multiplePages = false } = {}) {
  const calls = [];
  let failing = failUntilRetry;
  calls.recover = () => { failing = false; };
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (url.pathname === '/api/v1/events/calendar-event') return reply({ event });
    if (url.pathname !== '/api/v1/events') return reply({}, 404);
    calls.push(Object.fromEntries(url.searchParams));
    if (failing) return reply({}, 503);
    if (url.searchParams.get('from') !== '2035-11-01T00:00:00+07:00') return reply({ data: [], total: 0, page: 1 });
    const current = Number(url.searchParams.get('page'));
    if (multiplePages) {
      const data = current === 1 ? Array.from({ length: 20 }, (_, i) => ({ ...event, eventId: `event-${i}`, title: `Agenda Kampus ${i + 1}` }))
        : [{ ...event, eventId: 'last-event', title: 'Agenda Halaman Kedua' }];
      return reply({ data, total: 21, page: current });
    }
    return reply({ data: [event], total: 1, page: current });
  });
  return calls;
}

test('WIB month, selected day, details and return preserve calendar URL', async ({ page }, testInfo) => {
  const calls = await fixture(page);
  await page.goto('/events/calendar?month=2035-11');
  await expect(page.getByRole('link', { name: event.title })).toBeVisible();
  expect(calls[0]).toMatchObject({ from: '2035-11-01T00:00:00+07:00', to: '2035-12-01T00:00:00+07:00', limit: '20' });
  await page.getByRole('button', { name: '1 November 2035, 1 event', exact: true }).click();
  await expect(page).toHaveURL(/date=2035-11-01/);
  await page.screenshot({ path: testInfo.outputPath('kalender-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: event.title }).click();
  await expect(page.getByRole('heading', { name: event.title })).toBeVisible();
  await page.getByRole('link', { name: 'Kembali ke kalender' }).click();
  await expect(page).toHaveURL(/month=2035-11&date=2035-11-01/);
  await expect(page.getByRole('button', { name: '1 November 2035, 1 event', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Agenda 1 November 2035' })).toBeVisible();
});

test('month navigation, empty date, all dates and browser back work', async ({ page }) => {
  await fixture(page);
  await page.goto('/events/calendar?month=2035-11');
  await page.getByRole('button', { name: '2 November 2035, 0 event', exact: true }).click();
  await expect(page.getByText('Tidak ada event yang dimulai pada tanggal ini.')).toBeVisible();
  await page.getByRole('button', { name: 'Tampilkan semua tanggal' }).click();
  await expect(page.getByRole('link', { name: event.title })).toBeVisible();
  await page.getByRole('button', { name: 'Bulan berikutnya' }).click();
  await expect(page.getByRole('heading', { name: 'Desember 2035', exact: true })).toBeVisible();
  await expect(page.getByText('Belum ada event untuk bulan ini.')).toBeVisible();
  await expect(page.getByRole('link', { name: event.title })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('link', { name: event.title })).toBeVisible();
  await page.getByRole('button', { name: 'Bulan sebelumnya' }).click();
  await expect(page).toHaveURL(/month=2035-10/);
});

test('API failure can retry without displaying an empty month as success', async ({ page }) => {
  const calls = await fixture(page, { failUntilRetry: true });
  await page.goto('/events/calendar?month=2035-11');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Belum ada event untuk bulan ini.')).toHaveCount(0);
  calls.recover();
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.getByRole('link', { name: event.title })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('loads events beyond page one', async ({ page }) => {
  const calls = await fixture(page, { multiplePages: true });
  await page.goto('/events/calendar?month=2035-11');
  await expect(page.getByRole('link', { name: 'Agenda Halaman Kedua' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 November 2035, 21 event', exact: true })).toBeVisible();
  expect(calls.some((call) => call.page === '2')).toBe(true);
});

test('invalid URL dates fall back safely; today uses WIB', async ({ page }) => {
  await page.clock.install({ time: new Date('2035-10-31T18:00:00Z') });
  await fixture(page);
  await page.goto('/events/calendar?month=invalid&date=2035-02-31');
  await expect(page.getByRole('heading', { name: 'November 2035', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hari ini', exact: true }).click();
  await expect(page).toHaveURL(/month=2035-11&date=2035-11-01/);
  await expect(page.getByRole('button', { name: '1 November 2035, 1 event', exact: true })).toHaveAttribute('aria-current', 'date');
});

test('mobile calendar fits 360px and supports keyboard date selection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await fixture(page);
  await page.goto('/events/calendar?month=2035-11');
  const day = page.getByRole('button', { name: '1 November 2035, 1 event', exact: true });
  await day.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Agenda 1 November 2035' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('kalender-mobile.png'), fullPage: true });
});

test('Sprint 2 regression: RSVP on page two is shown as already registered', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('eventku.auth.token', 'calendar-student'));
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const reply = (json) => route.fulfill({ json });
    if (url.pathname === '/api/v1/auth/me') return reply({ userId: 'student-13', role: 'mahasiswa', status: 'active', ukwmsVerified: true });
    if (url.pathname === '/api/v1/events/calendar-event') return reply({ event: { ...event, startAt: '2099-11-01T02:00:00Z', endAt: '2099-11-01T04:00:00Z' } });
    if (url.pathname === '/api/v1/registrations/me') {
      const current = Number(url.searchParams.get('page'));
      const data = current === 1 ? Array.from({ length: 20 }, (_, i) => ({ registrationId: `reg-${i}`, eventId: `other-${i}`, status: 'aktif' }))
        : [{ registrationId: 'registered', eventId: event.eventId, status: 'aktif' }];
      return reply({ data, total: 21, page: current });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto('/events/calendar-event');
  await expect(page.getByText('Anda sudah terdaftar di event ini.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Daftar Event', exact: true })).toHaveCount(0);
});
