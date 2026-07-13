import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PANEL_ADMIN_SMOKE_PORT ?? 3102);

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      NEXT_PUBLIC_PANEL_ADMIN_DEMO: "true"
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
