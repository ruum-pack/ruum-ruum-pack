import { defineConfig, devices } from '@playwright/test';

const disableAuthArtifacts = process.env.PLAYWRIGHT_DISABLE_AUTH_ARTIFACTS === '1';
const isDummySupabase =
  !process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY === 'ci-service-role' ||
  (process.env.PLAYWRIGHT_SUPABASE_URL || '').includes('ci.supabase.test');
const skipGlobalSetup = process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === '1' || isDummySupabase;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
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
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/conductor.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'tests/.auth/conductor.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'tests/.auth/conductor.json' },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], storageState: 'tests/.auth/conductor.json' },
      dependencies: ['setup'],
    },
  ],
  globalSetup: skipGlobalSetup ? undefined : './tests/global-setup.ts',
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm dev',
        port: 3001,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          SUPABASE_URL: process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
      },
});
