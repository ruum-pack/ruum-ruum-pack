import { test as setup } from "@playwright/test";

const AUTH_STATE_PATH = "tests/.auth/conductor.json";

setup("autenticar conductor", async ({ page, context }) => {
  // Navega a login y espera que la red esté inactiva
  await page.goto("/login", { waitUntil: "networkidle" });
  
  // Espera a que el formulario de login sea visible antes de interactuar
  await page.waitForSelector('input[type="email"]', { timeout: 10000 }).catch(async (err) => {
    const pageUrl = page.url();
    const pageText = await page.innerText("body").catch(() => "");
    throw new Error(
      `Email input no encontrado en ${pageUrl}. Contenido: ${pageText.substring(0, 200)}`
    );
  });
  
  // Obtén las credenciales
  const email = process.env.PLAYWRIGHT_E2E_CONDUCTOR_EMAIL || "test@example.test";
  const password = process.env.PLAYWRIGHT_E2E_CONDUCTOR_PASSWORD || "TestPass123!";
  
  // Rellena los campos
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Espera a que el botón submit esté visible y clickeable
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.waitFor({ state: "visible", timeout: 5000 }).catch(async (err) => {
    throw new Error(`Botón submit no encontrado o no es visible: ${err.message}`);
  });
  
  // Click en el botón de login
  await submitButton.click();
  
  // Espera a que navegue a una ruta protegida (panel o viajes)
  await page.waitForURL(/\/(panel|viajes)/, { timeout: 15000 }).catch(async (err) => {
    const currentUrl = page.url();
    throw new Error(
      `Login falló. URL actual: ${currentUrl}. Esperaba /panel o /viajes. Error: ${err.message}`
    );
  });
  
  // Guarda el estado de autenticación
  await context.storageState({ path: AUTH_STATE_PATH });
  console.log(`✓ Autenticación exitosa guardada en ${AUTH_STATE_PATH}`);
});
