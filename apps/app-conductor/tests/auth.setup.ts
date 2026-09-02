import { test as setup } from "@playwright/test";

const AUTH_STATE_PATH = "tests/.auth/conductor.json";

setup("autenticar conductor", async ({ page, context }) => {
  await page.goto("/login");
  
  // Usa las variables de entorno del CI
  const email = process.env.PLAYWRIGHT_E2E_CONDUCTOR_EMAIL || "test@example.test";
  const password = process.env.PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD || "TestPass123!";
  
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Espera a que llegue a una ruta protegida
  await page.waitForURL(/\/panel|viajes/);
  
  // Guarda el estado de autenticación
  await context.storageState({ path: AUTH_STATE_PATH });
});
