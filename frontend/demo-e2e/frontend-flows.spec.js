import { test, expect } from '@playwright/test';

const demoPassword = 'EventKuDemo123!';
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/060AAAAASUVORK5CYII=', 'base64');

async function login(page, email, password = demoPassword) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun' })).toBeVisible();
}

function wibTime(instant) {
  return new Date(instant + 25_200_000).toISOString().slice(0, 16);
}

function row(page, title) {
  return page.getByRole('listitem').filter({ hasText: title });
}

test('proposal upload, publication, student registration, re-moderation, cancellation and history', async ({ browser, baseURL }) => {
  const organizer = await browser.newContext({ baseURL });
  const student = await browser.newContext({ baseURL, viewport: { width: 360, height: 800 } });
  const admin = await browser.newContext({ baseURL });
  try {
    const organizerPage = await organizer.newPage();
    const studentPage = await student.newPage();
    const adminPage = await admin.newPage();
    await Promise.all([
      login(organizerPage, 'penyelenggara@demo.test'),
      login(studentPage, 'mahasiswa@demo.test'),
      login(adminPage, 'admin@demo.test'),
    ]);

    await studentPage.getByRole('link', { name: 'Atur minat' }).click();
    await studentPage.getByRole('checkbox', { name: 'Workshop' }).check();
    await studentPage.getByRole('button', { name: 'Simpan minat' }).click();
    await expect(studentPage.getByRole('status')).toHaveText('Kategori minat disimpan.');
    await studentPage.getByRole('checkbox', { name: 'Terima salinan notifikasi melalui email' }).check();
    await studentPage.getByRole('button', { name: 'Simpan preferensi email' }).click();
    await expect(studentPage.getByRole('status')).toHaveText('Preferensi email disimpan.');

    await organizerPage.getByRole('link', { name: 'Ajukan event' }).click();
    const title = 'Workshop Demo Alur Lengkap';
    const start = Date.now() + 180 * 60_000;
    await organizerPage.getByLabel('Judul event').fill(title);
    await organizerPage.getByLabel('Deskripsi').fill('Latihan alur pengajuan sampai moderasi dan RSVP.');
    await organizerPage.getByLabel('Kategori', { exact: true }).selectOption('workshop');
    await organizerPage.getByLabel('Mulai (WIB)').fill(wibTime(start));
    await organizerPage.getByLabel('Selesai (WIB)').fill(wibTime(start + 7_200_000));
    await organizerPage.getByLabel('Lokasi atau tautan').fill('Aula Lama');
    await organizerPage.getByLabel('Kuota peserta').fill('8');
    await organizerPage.getByLabel('Unggah poster').setInputFiles({ name: 'poster.png', mimeType: 'image/png', buffer: image });
    await expect(organizerPage.getByText('Poster berhasil diunggah.')).toBeVisible();
    const posterUrl = await organizerPage.getByLabel('URL poster').inputValue();
    expect((await organizer.request.get(posterUrl)).headers()['content-type']).toBe('image/png');
    await organizerPage.getByRole('button', { name: 'Ajukan event', exact: true }).click();
    await expect(organizerPage.getByRole('heading', { name: 'Menunggu Moderasi' })).toBeVisible();

    await adminPage.getByRole('link', { name: 'Buka antrean moderasi' }).click();
    const awaiting = row(adminPage, title);
    await awaiting.getByRole('button', { name: 'Setujui', exact: true }).click();
    await awaiting.getByRole('button', { name: 'Setujui dan publikasikan' }).click();
    await expect(awaiting).toHaveCount(0);

    await studentPage.goto('/mahasiswa/notifikasi');
    const notice = row(studentPage, title);
    await expect(notice.getByText('Event baru sesuai minat')).toBeVisible();
    await notice.getByRole('button', { name: 'Tandai sudah dibaca' }).click();
    await expect(notice.getByText('Sudah dibaca', { exact: true })).toBeVisible();
    await studentPage.getByRole('link', { name: 'Lihat kotak email demo' }).click();
    await expect(row(studentPage, title).getByText('Kepada mahasiswa@demo.test', { exact: false })).toBeVisible();
    await studentPage.goto('/mahasiswa/notifikasi');
    await row(studentPage, title).getByRole('link', { name: 'Lihat event' }).click();
    const eventUrl = new URL(studentPage.url());
    await studentPage.getByRole('button', { name: 'Simpan ke favorit' }).click();
    await expect(studentPage.getByRole('button', { name: 'Hapus dari favorit' })).toBeVisible();
    await studentPage.getByRole('button', { name: 'Daftar Event', exact: true }).click();
    await expect(studentPage.getByText('Pendaftaran berhasil.', { exact: true })).toBeVisible();

    await studentPage.goto('/events/calendar?month=' + wibTime(start).slice(0, 7));
    await studentPage.getByLabel('Kategori', { exact: true }).selectOption('workshop');
    await expect(studentPage.getByRole('link', { name: title }).locator('..').getByText('Terdaftar', { exact: true })).toBeVisible();
    expect(await studentPage.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
    await studentPage.goto('/mahasiswa/notifikasi');
    await expect(studentPage.getByRole('heading', { name: 'Pengingat H-1' })).toBeVisible();

    await organizerPage.goto('/penyelenggara/event');
    await organizerPage.getByRole('button', { name: 'Berikutnya' }).click();
    await row(organizerPage, title).getByRole('link', { name: 'Kelola event' }).click();
    await organizerPage.getByRole('button', { name: 'Edit event' }).click();
    await organizerPage.getByLabel('Lokasi atau tautan').fill('Aula Baru');
    await organizerPage.getByRole('button', { name: 'Simpan perubahan event' }).click();
    await expect(organizerPage.getByText('Menunggu moderasi', { exact: true })).toBeVisible();
    expect((await student.request.get('/api/v1' + eventUrl.pathname)).status()).toBe(404);
    await studentPage.goto('/mahasiswa/notifikasi');
    await expect(studentPage.getByRole('heading', { name: 'Jadwal event berubah' })).toBeVisible();

    await organizerPage.getByRole('button', { name: 'Batalkan event', exact: true }).click();
    await organizerPage.getByRole('button', { name: 'Ya, batalkan event' }).click();
    await expect(organizerPage.getByText('Dibatalkan', { exact: true })).toBeVisible();
    await studentPage.goto('/mahasiswa/notifikasi');
    await expect(studentPage.getByRole('heading', { name: 'Event dibatalkan' })).toBeVisible();
    await adminPage.goto('/admin/moderasi/riwayat');
    await expect(row(adminPage, title).getByText('Admin Demo', { exact: false })).toBeVisible();
  } finally {
    await Promise.all([organizer.close(), student.close(), admin.close()]);
  }
});

test('student submits a review only through an attended completed event', async ({ page }) => {
  await login(page, 'mahasiswa@demo.test');
  await page.getByRole('link', { name: 'Pendaftaran saya' }).click();
  await page.getByRole('button', { name: 'Riwayat', exact: true }).click();
  await row(page, 'Lokakarya Orientasi (Demo)').getByRole('link', { name: 'Beri ulasan' }).click();
  await page.getByLabel('Rating').selectOption('5');
  await page.getByLabel('Ulasan').fill('Materi jelas dan praktis.');
  await page.getByRole('button', { name: 'Simpan ulasan' }).click();
  await expect(page.getByRole('status')).toHaveText('Ulasan disimpan.');
  await page.reload();
  await expect(page.getByLabel('Ulasan')).toHaveValue('Materi jelas dan praktis.');
  await page.goto('/mahasiswa/ulasan/demo-event-1');
  await expect(page.getByRole('alert')).toContainText('tidak memiliki izin');
});

test('profile and password recovery work through a demo mailbox link', async ({ page, request }) => {
  const email = 'akun-pemulihan@demo.test';
  const newPassword = 'EventKuReset123!';
  const changedPassword = 'EventKuUbah123!';
  const registered = await request.post('/api/v1/auth/register', { data: { name: 'Akun Awal', email, password: demoPassword, role: 'mahasiswa' } });
  expect(registered.ok()).toBeTruthy();
  await page.goto('/bantuan-akun');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Kirim tautan pemulihan' }).click();
  await page.getByRole('link', { name: 'Buka tautan pemulihan demo' }).click();
  await page.locator('#reset-password').fill(newPassword);
  await page.locator('#reset-confirm').fill(newPassword);
  await page.getByRole('button', { name: 'Atur ulang kata sandi' }).click();
  await expect(page.getByRole('status')).toHaveText('Kata sandi berhasil diatur ulang.');
  await login(page, email, newPassword);
  await page.getByRole('link', { name: 'Pengaturan akun' }).click();
  await page.getByLabel('Nama lengkap').fill('Akun Terbarui');
  await page.getByRole('button', { name: 'Simpan profil' }).click();
  await expect(page.getByRole('status')).toHaveText('Profil diperbarui.');
  await page.locator('#current-password').fill(newPassword);
  await page.locator('#new-password').fill(changedPassword);
  await page.locator('#confirm-new-password').fill(changedPassword);
  await page.getByRole('button', { name: 'Simpan kata sandi baru' }).click();
  await expect(page.getByText('Kata sandi diperbarui.')).toBeVisible();
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await login(page, email, changedPassword);
  await expect(page.getByText('Akun Terbarui', { exact: true })).toBeVisible();
});

test('admin can disable accounts, unpublish events and inspect statistics', async ({ page, request }) => {
  await login(page, 'admin@demo.test');
  await page.getByRole('link', { name: 'Kelola pengguna' }).click();
  const account = row(page, 'mahasiswa.luar@demo.test');
  await account.getByRole('button', { name: 'Nonaktifkan akun', exact: true }).click();
  await account.getByRole('button', { name: 'Ya, nonaktifkan akun' }).click();
  await expect(account.getByText('Nonaktif', { exact: true })).toBeVisible();
  const disabledLogin = await request.post('/api/v1/auth/login', {
    data: { email: 'mahasiswa.luar@demo.test', password: demoPassword },
  });
  expect(disabledLogin.status()).toBe(401);
  await account.getByRole('button', { name: 'Aktifkan kembali' }).click();
  await account.getByRole('button', { name: 'Ya, aktifkan akun' }).click();
  await expect(account.getByText('Aktif', { exact: true })).toBeVisible();

  await page.goto('/admin/moderasi/tayang');
  const publicEvent = row(page, 'Seminar Literasi Digital');
  await publicEvent.getByRole('button', { name: 'Turunkan event' }).click();
  await publicEvent.getByLabel('Alasan penurunan').fill('Informasi publik belum dapat diverifikasi.');
  await publicEvent.getByRole('button', { name: 'Konfirmasi penurunan' }).click();
  await expect(publicEvent).toHaveCount(0);
  expect((await request.get('/api/v1/events/demo-event-5')).status()).toBe(404);

  await page.goto('/admin/statistik');
  await expect(page.getByRole('heading', { name: 'Event per kategori' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Event per bulan (WIB)' })).toBeVisible();
  const organizer = await page.context().newPage();
  await login(organizer, 'penyelenggara@demo.test');
  await organizer.getByRole('link', { name: 'Statistik organisasi' }).click();
  await expect(organizer.getByRole('heading', { name: 'Tren pendaftaran aktif (WIB)' })).toBeVisible();
});
