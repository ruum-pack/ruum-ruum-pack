import { test as setup } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const AUTH_STATE_PATH = "tests/.auth/conductor.json";

setup("autenticar conductor", async ({ page, context }) => {
  // 🔥 Determinar si estamos en CI
  const isCI = process.env.CI === 'true' || process.env.CI === '1';
  
  // 🔥 Detectar entorno dummy SOLO si NO estamos en CI
  const isDummy = !isCI && (
    !process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.PLAYWRIGHT_SUPABASE_SERVICE_ROLE_KEY === 'ci-service-role' ||
    (process.env.PLAYWRIGHT_SUPABASE_URL || '').includes('ci.supabase.test') ||
    process.env.PLAYWRIGHT_SKIP_GLOBAL_SETUP === '1'
  );

  // 🔥 Si es dummy y no estamos en CI, crear estado vacío
  if (isDummy) {
    console.log(`[auth.setup] Dummy Supabase detectado — omitiendo login real, usando estado vacío`);
    try {
      mkdirSync(dirname(resolve(process.cwd(), AUTH_STATE_PATH)), { recursive: true });
      if (!existsSync(resolve(process.cwd(), AUTH_STATE_PATH))) {
        writeFileSync(resolve(process.cwd(), AUTH_STATE_PATH), JSON.stringify({ cookies: [], origins: [] }));
      }
    } catch (err) {
      console.warn('[auth.setup] Error creando archivo de estado vacío:', err);
    }
    return;
  }

  // 🔥 En CI, FORZAR autenticación real (incluso si las variables parecen dummy)
  const email = process.env.PLAYWRIGHT_E2E_CONDUCTOR_EMAIL;
  const password = process.env.PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD;
  
  if (!email || !password) {
    console.error(`[auth.setup] ❌ Credenciales faltantes: EMAIL=${email}, PASSWORD=${password ? '***' : 'undefined'}`);
    throw new Error('Credenciales de autenticación no configuradas en CI');
  }

  console.log(`[auth.setup] 🔥 Iniciando autenticación REAL en CI`);
  console.log(`[auth.setup] 📧 Email: ${email}`);
  console.log(`[auth.setup] 🔑 Password: ${password.substring(0, 3)}...`);
  console.log(`[auth.setup] 🌐 Supabase URL: ${process.env.PLAYWRIGHT_SUPABASE_URL}`);

  // 1. Si ya existe un archivo de sesión con cookies válidas, reutilizarlo
  const resolvedPath = resolve(process.cwd(), AUTH_STATE_PATH);
  if (existsSync(resolvedPath)) {
    try {
      const content = JSON.parse(readFileSync(resolvedPath, "utf-8"));
      if (content.cookies && content.cookies.length > 0) {
        console.log(`✓ Reutilizando sesión existente desde ${AUTH_STATE_PATH}`);
        console.log(`📊 Cookies: ${content.cookies.length}, Origins: ${content.origins?.length || 0}`);
        return;
      } else {
        console.log(`[auth.setup] Archivo de sesión existe pero está vacío, procediendo a autenticar.`);
      }
    } catch (err) {
      console.log(`[auth.setup] Error al leer archivo de sesión, procediendo a autenticar.`);
    }
  }

  // 2. Configurar localStorage para evitar onboarding
  await page.addInitScript(() => {
    try {
      localStorage.setItem("CapacitorStorage.ruum_conductor_onboarding_visto", "1");
      localStorage.setItem("ruum_conductor_onboarding_visto", "1");
    } catch {}
  });

  console.log(`[auth.setup] 🌐 Navegando a /login...`);
  await page.goto("/login");

  // Si ya estamos autenticados (redirigido a /panel o /viajes), guardar estado y salir
  if (page.url().includes("/panel") || page.url().includes("/viajes")) {
    await context.storageState({ path: AUTH_STATE_PATH });
    console.log(`✓ Sesión ya activa guardada en ${AUTH_STATE_PATH}`);
    return;
  }

  // Si redirigió a onboarding, forzar login nuevamente
  if (page.url().includes("/onboarding")) {
    await page.evaluate(() => {
      localStorage.setItem("CapacitorStorage.ruum_conductor_onboarding_visto", "1");
      localStorage.setItem("ruum_conductor_onboarding_visto", "1");
    });
    await page.goto("/login");
  }

  // Esperar el formulario de login
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: "visible", timeout: 15000 });

  console.log(`[auth.setup] 📧 Completando email y password...`);
  await emailInput.fill(email);
  await page.locator('input[type="password"]').fill(password);

  const submitButton = page.locator('button[type="submit"]');
  await submitButton.waitFor({ state: "visible", timeout: 5000 });
  await submitButton.click();

  console.log(`[auth.setup] ⏳ Esperando redirección a /panel o /viajes...`);
  await page.waitForURL(/\/(panel|viajes)/, { timeout: 20000 });

  // Guardar el estado de autenticación
  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`✅ Autenticación exitosa guardada en ${AUTH_STATE_PATH}`);
});