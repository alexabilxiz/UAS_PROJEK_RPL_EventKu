import { defineConfig, devices } from '@playwright/test';

const port = 4191;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './demo-e2e',
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --mode demo --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
