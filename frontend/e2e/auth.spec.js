import { test, expect } from '@playwright/test';

// Browser-level integration fixtures. These are contract tests, not evidence that
// Audrey's backend is deployed, reachable, or has passed its own authentication tests.
const TOKEN = 'contract-test-token-not-a-production-credential';
const student = {
  userId: 'student-01',
  name: 'Mahasiswa Kampus',
  email: 'mahasiswa@example.test',
  role: 'mahasiswa',
  status: 'active',
  organization: null,
};

async function mockAuth(page, options = {}) {
  const requests = [];
  const profile = options.profile ?? student;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const entry = {
      path,
      method: request.method(),
      body: request.postDataJSON(),
      authorization: request.headers().authorization,
    };
    requests.push(entry);
    if (path === '/api/v1/auth/login') {
      if (options.abortLogin) return route.abort('failed');
      return route.fulfill({
        status: options.loginStatus ?? 200,
        json: options.loginBody ?? { accessToken: TOKEN, user: profile },
      });
    }
    if (path === '/api/v1/auth/me') {
      return route.fulfill({
        status: options.meStatus ?? 200,
        json: options.meBody ?? profile,
      });
    }
    if (path === '/api/v1/auth/register') {
      return route.fulfill({
        status: options.registerStatus ?? 201,
        json: options.registerBody ?? {
          userId: 'new-user',
          role: entry.body.role,
          status: entry.body.role === 'penyelenggara' ? 'pending' : 'active',
          organizationId: entry.body.organizationId ?? null,
        },
      });
    }
    return route.fulfill({ status: 404, json: { message: 'Fixture endpoint unavailable.' } });
  });
  return requests;
}

async function enterLogin(page, { remember = false } = {}) {
  await page.getByLabel('Email', { exact: true }).fill(student.email);
  await page.getByLabel('Kata sandi', { exact: true }).fill('Rahasia123!');
  if (remember) await page.getByLabel('Ingat saya', { exact: true }).check();
  else await page.getByLabel('Ingat saya', { exact: true }).uncheck();
}

async function enterRegister(page, overrides = {}) {
  const fields = {
    name: 'Pengguna Kampus',
    email: 'baru@example.test',
    password: 'Rahasia123!',
    confirmation: 'Rahasia123!',
    role: 'mahasiswa',
    ...overrides,
  };
  await page.getByLabel('Nama lengkap', { exact: true }).fill(fields.name);
  await page.getByLabel('Email', { exact: true }).fill(fields.email);
  await page.getByLabel('Peran akun', { exact: true }).selectOption(fields.role);
  if (fields.role === 'penyelenggara') {
    await page.getByLabel('ID organisasi', { exact: true }).fill(fields.organizationId ?? 'org-01');
  }
  await page.getByLabel('Kata sandi', { exact: true }).fill(fields.password);
  await page.getByLabel('Konfirmasi kata sandi', { exact: true }).fill(fields.confirmation);
}

async function readStorage(page) {
  return page.evaluate(() => ({
    session: Object.fromEntries(Object.entries(sessionStorage)),
    local: Object.fromEntries(Object.entries(localStorage)),
  }));
}

test('login uses the Auth contract and restores the session through /me', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/login');
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  const login = requests.find((r) => r.path.endsWith('/login'));
  expect(login.body).toEqual({ email: student.email, password: 'Rahasia123!' });
  const me = requests.find((r) => r.path.endsWith('/me'));
  expect(me.authorization).toBe(`Bearer ${TOKEN}`);
  const storage = await readStorage(page);
  expect(Object.values(storage.session)).toContain(TOKEN);
  expect(Object.values(storage.local)).not.toContain(TOKEN);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  expect(requests.filter((r) => r.path.endsWith('/me')).length).toBeGreaterThan(1);
});

test('remembered session persists and logout clears both token stores', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/login');
  await enterLogin(page, { remember: true });
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  expect(Object.values((await readStorage(page)).local)).toContain(TOKEN);
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/dashboard/);
  const storage = await readStorage(page);
  expect(Object.values(storage.local)).not.toContain(TOKEN);
  expect(Object.values(storage.session)).not.toContain(TOKEN);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('replacing a remembered token does not sign out both open tabs', async ({ page, context }) => {
  await mockAuth(page);
  await page.goto('/login');
  await enterLogin(page, { remember: true });
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  const otherTab = await context.newPage();
  await mockAuth(otherTab);
  await otherTab.goto('/dashboard');
  await expect(otherTab.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  await otherTab.evaluate(() => {
    window.authStorageEvents = [];
    window.addEventListener('storage', (event) => {
      if (event.key === 'eventku.auth.token') window.authStorageEvents.push(event.newValue);
    });
  });
  // A same-origin login can replace a previously remembered token. The deletion
  // event for the old value must not erase the replacement in another tab.
  const replacement = 'replacement-contract-token-not-a-production-credential';
  await page.evaluate((value) => {
    localStorage.removeItem('eventku.auth.token');
    localStorage.setItem('eventku.auth.token', value);
  }, replacement);
  await otherTab.waitForFunction((value) => window.authStorageEvents.includes(value), replacement);
  await otherTab.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(otherTab.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  expect((await readStorage(page)).local['eventku.auth.token']).toBe(replacement);
  expect((await readStorage(otherTab)).local['eventku.auth.token']).toBe(replacement);
  // A real sign-out still propagates without writing the removed token back.
  await page.getByRole('button', { name: 'Keluar', exact: true }).click();
  await expect(otherTab).toHaveURL(/\/login/);
  expect((await readStorage(otherTab)).local['eventku.auth.token']).toBeUndefined();
});

test('an unauthenticated protected route returns to the intended internal screen', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/mahasiswa');
  await expect(page).toHaveURL(/\/login/);
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ruang mahasiswa', exact: true })).toBeVisible();
});

test('a student cannot navigate to the admin screen but keeps their valid session', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/login');
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Akses terbatas', exact: true })).toBeVisible();
  expect(Object.values((await readStorage(page)).session)).toContain(TOKEN);
});

test('role navigation follows the authoritative /me profile instead of login metadata', async ({ page }) => {
  await mockAuth(page, {
    loginBody: { accessToken: TOKEN, user: { ...student, role: 'admin' } },
    meBody: student,
  });
  await page.goto('/login');
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Akses terbatas', exact: true })).toBeVisible();
});

test('expired session is cleared after a 401 from /me', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/login');
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beranda akun', exact: true })).toBeVisible();
  await page.unroute('**/api/v1/**');
  await mockAuth(page, { meStatus: 401, meBody: { message: 'Token expired.' } });
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  expect(Object.values((await readStorage(page)).session)).not.toContain(TOKEN);
});

test('a 403 from the profile endpoint does not discard a stored token', async ({ page }) => {
  await mockAuth(page, { meStatus: 403, meBody: { message: 'Forbidden' } });
  await page.addInitScript((token) => {
    sessionStorage.setItem('eventku.auth.token', token);
  }, TOKEN);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Sesi belum dapat diperiksa', exact: true })).toBeVisible();
  expect(Object.values((await readStorage(page)).session)).toContain(TOKEN);
});

test('external login redirect is not followed', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/login?redirect=https%3A%2F%2Fevil.example%2F');
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/dashboard');
});

test('student registration excludes confirmation and creates no authenticated session', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/register');
  await enterRegister(page);
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(requests.find((r) => r.path.endsWith('/register')).body).toEqual({
    name: 'Pengguna Kampus', email: 'baru@example.test', password: 'Rahasia123!', role: 'mahasiswa',
  });
  expect(requests.some((r) => r.path.endsWith('/login'))).toBe(false);
  const storage = await readStorage(page);
  expect(Object.values(storage.local)).not.toContain(TOKEN);
  expect(Object.values(storage.session)).not.toContain(TOKEN);
});

test('organizer registration requires an organization ID and never offers public admin signup', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/register');
  const role = page.getByLabel('Peran akun', { exact: true });
  await expect(role.locator('option[value="admin"]')).toHaveCount(0);
  await enterRegister(page, { role: 'penyelenggara', organizationId: 'org-01' });
  await page.getByLabel('ID organisasi', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/register/);
  expect(requests.filter((r) => r.path.endsWith('/register'))).toHaveLength(0);
  await page.getByLabel('ID organisasi', { exact: true }).fill('org-01');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(requests.find((r) => r.path.endsWith('/register')).body.organizationId).toBe('org-01');
});

test('invalid registration passwords never reach the API', async ({ page }) => {
  const requests = await mockAuth(page);
  await page.goto('/register');
  await enterRegister(page, { password: 'short', confirmation: 'short' });
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/register/);
  expect(requests.filter((r) => r.path.endsWith('/register'))).toHaveLength(0);
  await page.getByLabel('Kata sandi', { exact: true }).fill('Rahasia123!');
  await page.getByLabel('Konfirmasi kata sandi', { exact: true }).fill('berbeda123');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/register/);
  expect(requests.filter((r) => r.path.endsWith('/register'))).toHaveLength(0);
});

test('duplicate email stays on signup and displays a safe actionable error', async ({ page }) => {
  await mockAuth(page, { registerStatus: 409, registerBody: { message: 'Email sudah terdaftar.' } });
  await page.goto('/register');
  await enterRegister(page);
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByRole('alert')).toContainText(/email|terdaftar/i);
});

test('bad credentials and network failure remain recoverable without a session', async ({ page }) => {
  await mockAuth(page, { loginStatus: 401, loginBody: { message: 'Unauthorized' } });
  await page.goto('/login');
  await enterLogin(page);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/email|kata sandi|kredensial/i);
  await page.unroute('**/api/v1/**');
  await mockAuth(page, { abortLogin: true });
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/koneksi|terhubung|jaringan|server/i);
  await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeEnabled();
  expect(Object.values((await readStorage(page)).session)).not.toContain(TOKEN);
});

test('password visibility controls preserve the entered value', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByLabel('Kata sandi', { exact: true });
  await password.fill('Rahasia123!');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Tampilkan kata sandi', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('Rahasia123!');
  await page.getByRole('button', { name: 'Sembunyikan kata sandi', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('auth screens fit desktop and 360px mobile layouts', async ({ page }, testInfo) => {
  for (const [width, height, name] of [[1440, 1000, 'desktop'], [360, 800, 'mobile']]) {
    await page.setViewportSize({ width, height });
    for (const route of ['login', 'register']) {
      await page.goto(`/${route}`);
      await expect(page.getByRole('button', { name: route === 'login' ? 'Masuk' : 'Buat akun', exact: true })).toBeVisible();
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits, `${route} should not overflow at ${width}px`).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${route}-${name}.png`), fullPage: true });
    }
  }
});
