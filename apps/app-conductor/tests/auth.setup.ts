import { test as setup } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_STATE_PATH = "tests/.auth/conductor.json";

setup("autenticar conductor", async ({ page, context }) => {
  // 0. En CI sin Supabase real (dummy), no intentar login real — usar estado vacío
  const isDummy =
    !process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY === 'ci-service-role' ||
    (process.env.PLAYWRIGHT_SUPABASE_URL || '').includes('ci.supabase.test') ||
    process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === '1';
  if (isDummy) {
    console.log(`[auth.setup] Dummy Supabase detectado — omitiendo login real, usando estado vacío`);
    // Asegurar que el archivo exista para que los proyectos que usan storageState no fallen por ENOENT
    try {
      const { mkdirSync, writeFileSync } = await import('node:fs');
      const { dirname } = await import('node:path');
      mkdirSync(dirname(resolve(process.cwd(), AUTH_STATE_PATH)), { recursive: true });
      if (!existsSync(resolve(process.cwd(), AUTH_STATE_PATH))) {
        writeFileSync(resolve(process.cwd(), AUTH_STATE_PATH), JSON.stringify({ cookies: [], origins: [] }));
      }
    } catch {}
    return;
  }

  // 1. Si global-setup ya autenticó y guardó la sesión con cookies válidas, reutilizarla
  const resolvedPath = resolve(process.cwd(), AUTH_STATE_PATH);
  if (existsSync(resolvedPath)) {
    try {
      const content = JSON.parse(readFileSync(resolvedPath, "utf-8"));
      if ((content.cookies && content.cookies.length > 0) || (content.origins && content.origins.length > 0)) {
        console.log(`✓ Reutilizando sesión existente desde ${AUTH_STATE_PATH}`);
        return;
      }
    } catch {
      // Si el archivo no es JSON válido, procedemos a autenticar
    }
  }

  // 2. Prevenir que /login redirija a /onboarding configurando la bandera de bienvenida
  await page.addInitScript(() => {
    try {
      localStorage.setItem("CapacitorStorage.ruum_conductor_onboarding_visto", "1");
      localStorage.setItem("ruum_conductor_onboarding_visto", "1");
    } catch {}
  });

  await page.goto("/login");

  // Si ya estamos autenticados por cookies de sesión y redirigió a /panel o /viajes
  if (page.url().includes("/panel") || page.url().includes("/viajes")) {
    await context.storageState({ path: AUTH_STATE_PATH });
    return;
  }

  // Si aún cayó en /onboarding, marcar y recargar login
  if (page.url().includes("/onboarding")) {
    await page.evaluate(() => {
      localStorage.setItem("CapacitorStorage.ruum_conductor_onboarding_visto", "1");
      localStorage.setItem("ruum_conductor_onboarding_visto", "1");
    });
    await page.goto("/login");
  }

  // Esperar formulario de login
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 15000 });

  const email = process.env.PLAYWRIGHT_E2E_CONDUCTOR_EMAIL || "conductor-e2e@ruum.test";
  const password = process.env.PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD || "TestPass123!";

  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);

  const submitButton = page.locator('button[type="submit"]');
  await submitButton.waitFor({ state: "visible", timeout: 5000 });
  await submitButton.click();

  await page.waitForURL(/\/(panel|viajes)/, { timeout: 20000 });
  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`✓ Autenticación exitosa guardada en ${AUTH_STATE_PATH}`);
});
