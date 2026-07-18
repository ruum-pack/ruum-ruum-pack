import { defineConfig, devices } from '@playwright/test';

const disableAuthArtifacts = process.env.PLAYWRIGHT_DISABLE_AUTH_ARTIFACTS === '1';

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: disableAuthArtifacts ? 'off' : 'on-first-retry',
    screenshot: disableAuthArtifacts ? 'off' : 'only-on-failure',
    video: disableAuthArtifacts ? 'off' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  globalSetup: './tests/global-setup.ts',
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        port: 3001,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
