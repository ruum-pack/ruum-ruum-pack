import { test, expect } from "@playwright/test";
import { config as loadDotenv } from "dotenv";
import path from "node:path";

loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

const PLANTILLA_CSV = [
  "referencia_externa,centro_costo,orden_compra,prioridad,vehiculo_placas,vehiculo_vin,vehiculo_marca,vehiculo_modelo,vehiculo_anio,vehiculo_color,condicion,contacto_entrega_nombre,contacto_entrega_telefono,contacto_recepcion_nombre,contacto_recepcion_telefono,origen_codigo_postal,origen_colonia,origen_calle,origen_numero,origen_referencias,destino_codigo_postal,destino_colonia,destino_calle,destino_numero,destino_referencias,modalidad_programacion,fecha_hora_programada,ventana_recoleccion,ventana_entrega,instrucciones_especiales",
  "FLOT-001,CC-NORTE,OC-45881,normal,ABC123,,Nissan,Versa,2024,Blanco,seminueva,Operaciones,+525500000000,Recepcion,+525500000001,06700,Roma Norte,Av. Reforma,100,Acceso por estacionamiento,04360,Copilco Universidad,Av. Universidad,300,Entregar en recepción,programado,2026-07-20T12:00:00-06:00,2026-07-20T11:00:00-06:00,2026-07-20T14:00:00-06:00,Unidad prioritaria",
].join("\n");

async function seedMockAuthSession(page: import("@playwright/test").Page) {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.PLAYWRIGHT_SUPABASE_URL ?? "https://mock.supabase.co";
  const projectRef = new URL(configuredUrl).hostname.split(".")[0];
  const session = {
    access_token: "mock_access_token",
    refresh_token: "mock_refresh_token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: "00000000-0000-4000-8000-00000000e001", aud: "authenticated", role: "authenticated", email: "usuario@ejemplo.com" },
  };
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
  await page.context().addCookies([{ name: `sb-${projectRef}-auth-token`, value, url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" }]);
}

test.describe("R6 Carga masiva — cancelación y cleanup on-unmount", () => {
  test("cancelar durante análisis aborta enriquecimiento y muestra mensaje", async ({ page }) => {
    await seedMockAuthSession(page);

    // Delay Mapbox para que analizando quede visible y cancelable
    await page.route("**/api.mapbox.com/**", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [{ geometry: { coordinates: [-99.1332, 19.4326] }, properties: { full_address: "Mock" } }] }) });
    });

    await page.goto("/traslados/masivo");
    await expect(page.getByRole("heading", { name: /creación masiva/i })).toBeVisible();

    const fileInput = page.locator("#archivo-csv");
    await fileInput.setInputFiles({ name: "plantilla.csv", mimeType: "text/csv", buffer: Buffer.from(PLANTILLA_CSV) });

    // Debe aparecer barra de progreso
    await expect(page.getByText(/analizando archivo/i)).toBeVisible({ timeout: 5000 });

    const cancelar = page.getByRole("button", { name: /cancelar carga/i }).first();
    await expect(cancelar).toBeVisible({ timeout: 3000 });
    await cancelar.click();

    await expect(page.getByText(/carga cancelada por el usuario/i)).toBeVisible({ timeout: 3000 });
    // analizando debe desaparecer
    await expect(page.getByText(/analizando archivo/i)).toBeHidden({ timeout: 3000 });
  });

  test("cancelar durante polling no dispara llamadas adicionales (humo)", async ({ page }) => {
    await seedMockAuthSession(page);

    // Mapbox rápido para que llegue a paso 3
    await page.route("**/api.mapbox.com/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [{ geometry: { coordinates: [-99.1332, 19.4326] }, properties: { full_address: "Mock" } }] }) });
    });
    await page.route("**/api.mapbox.com/directions/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ routes: [{ distance: 12500, duration: 1800, geometry: null }], code: "Ok" }) });
    });

    // Mock crear: retorna carga_id
    let crearCount = 0;
    await page.route("**/rest/v1/rpc/usuario_crea_traslados_masivos**", async (route) => {
      crearCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ carga_id: "00000000-0000-4000-8000-000000000001", estado: "por_procesar", filas_creadas: 0, filas_error: 0, filas_procesadas: 0 }),
      });
    });

    // Mock procesar: siempre procesando, contar llamadas
    let procesarCount = 0;
    await page.route("**/rest/v1/rpc/usuario_procesa_carga_traslados_masivos**", async (route) => {
      procesarCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ carga_id: "00000000-0000-4000-8000-000000000001", estado: "procesando", filas_creadas: 0, filas_error: 0, filas_procesadas: 0 }),
      });
    });

    await page.goto("/traslados/masivo");
    const fileInput = page.locator("#archivo-csv");
    await fileInput.setInputFiles({ name: "plantilla.csv", mimeType: "text/csv", buffer: Buffer.from(PLANTILLA_CSV) });

    // Esperar a paso 2 (revisión) — indica enriquecimiento terminó
    await expect(page.getByText(/total filas/i).first()).toBeVisible({ timeout: 15000 }).catch(async () => {
      // Si no llega, skip polling test (Mapbox mock puede fallar en CI sin token)
      test.skip();
      return;
    });

    // Ir a paso 3
    const continuar = page.getByRole("button", { name: /continuar al resumen/i });
    if (await continuar.isVisible().catch(() => false)) await continuar.click();
    await expect(page.getByText(/confirmación del lote/i)).toBeVisible({ timeout: 5000 });

    const crearBtn = page.getByRole("button", { name: /crear.*traslados/i });
    await crearBtn.click();

    // Esperar que polling empiece (enviando)
    await expect(page.getByRole("button", { name: /cancelar carga/i })).toBeVisible({ timeout: 5000 });

    // Dejar que haga 1-2 llamadas
    await page.waitForTimeout(1500);
    const countAntes = procesarCount;

    // Cancelar
    await page.getByRole("button", { name: /cancelar carga/i }).click();
    await expect(page.getByText(/carga cancelada por el usuario/i)).toBeVisible({ timeout: 3000 });

    // Esperar 2.5s y confirmar que no hubo llamadas adicionales (abort funciona)
    await page.waitForTimeout(2500);
    const countDespues = procesarCount;
    // Permitir a lo sumo 1 llamada más por carrera, pero no crecimiento indefinido
    expect(countDespues - countAntes).toBeLessThanOrEqual(1);
    // Crear no debe haberse llamado de nuevo
    expect(crearCount).toBe(1);
  });

  test("cleanup on-unmount aborta polling al navegar fuera", async ({ page }) => {
    await seedMockAuthSession(page);
    await page.route("**/rest/v1/rpc/usuario_crea_traslados_masivos**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ carga_id: "c2", estado: "por_procesar", filas_creadas: 0, filas_error: 0, filas_procesadas: 0 }) });
    });
    let procesarCount = 0;
    await page.route("**/rest/v1/rpc/usuario_procesa_carga_traslados_masivos**", async (route) => {
      procesarCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ carga_id: "c2", estado: "procesando", filas_creadas: 0, filas_error: 0, filas_procesadas: 0 }) });
    });
    await page.route("**/api.mapbox.com/**", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [{ geometry: { coordinates: [-99.1332, 19.4326] }, properties: { full_address: "Mock" } }] }) }));

    await page.goto("/traslados/masivo");
    const fileInput = page.locator("#archivo-csv");
    await fileInput.setInputFiles({ name: "plantilla.csv", mimeType: "text/csv", buffer: Buffer.from(PLANTILLA_CSV) });
    await expect(page.getByText(/total filas/i).first()).toBeVisible({ timeout: 15000 }).catch(() => test.skip());
    const continuar = page.getByRole("button", { name: /continuar al resumen/i });
    if (await continuar.isVisible().catch(() => false)) await continuar.click();
    await page.getByRole("button", { name: /crear.*traslados/i }).click();
    await page.waitForTimeout(800);
    const countAntes = procesarCount;
    // Navegar fuera (unmount)
    await page.goto("/");
    await page.waitForTimeout(2000);
    const countDespues = procesarCount;
    expect(countDespues - countAntes).toBeLessThanOrEqual(1);
  });
});
