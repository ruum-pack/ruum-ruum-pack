import { test as setup, expect } from "@playwright/test";

const AUTH_STATE_PATH = "tests/.auth/conductor.json";

setup("autenticar conductor", async ({ page, context }) => {
  await page.goto("/login");
  
  // Wait for the login form to be fully loaded and stable
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  
  const email = process.env.PLAYWRIGHT_E2E_CONDUCTOR_EMAIL || "test@example.test";
  const password = process.env.PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD || "TestPass123!";
  
  // Fill form fields with explicit waits
  await page.fill('input[type="email"]', email, { timeout: 5000 });
  await page.fill('input[type="password"]', password, { timeout: 5000 });
  
  // Wait for button to be visible and enabled before clicking
  await page.waitForSelector('button[type="submit"]:not(:disabled)', { timeout: 5000 });
  await page.click('button[type="submit"]');
  
  // Wait for navigation to complete
  await page.waitForURL(/\/(panel|viajes)/, { timeout: 15000 });
  
  // Save authentication state
  await context.storageState({ path: AUTH_STATE_PATH });
});
