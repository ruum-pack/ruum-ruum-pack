import { defineConfig, devices } from '@playwright/test';

const disableAuthArtifacts = process.env.PLAYWRIGHT_DISABLE_AUTH_ARTIFACTS === '1';
// 3000 puede estar ocupado por Docker/WSL en el entorno de desarrollo; usar
// un puerto dedicado evita que Playwright confunda otro listener con Next.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3012);

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`,
    actionTimeout: 10_000,
    navigationTimeout: 60_000,
    trace: disableAuthArtifacts ? 'off' : 'on-first-retry',
    screenshot: disableAuthArtifacts ? 'off' : 'only-on-failure',
    video: disableAuthArtifacts ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `pnpm exec next dev -p ${PORT}`,
        port: PORT,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
