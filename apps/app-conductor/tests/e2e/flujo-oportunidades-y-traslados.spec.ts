import { test, expect } from "@playwright/test";

/**
 * Cierre de REPORTE_ERRORES_E2E.md (2026-08-16)
 *
 * Estos 4 tests cubren los 4 huecos críticos señalados en el reporte, con
 * aserciones reales sobre datos concretos del fixture de global-setup.ts
 * (no usan `.catch(() => true)` ni expects que siempre pasan).
 *
 * Fixture relevante (tests/global-setup.ts):
 * - E2E_AVAILABLE_TRIP_ID → estado "pendiente_de_conductor", sin conductor
 *   asignado. Origen: "Plaza de la Constitución 1". Destino: "Santa Fe,
 *   Vasco de Quiroga 3800".
 * - E2E_ACTIVE_TRIP_ID → estado "evidencia_inicial_en_proceso", ya asignado
 *   al conductor E2E. Vehículo: Toyota RAV4 E2E, placas "E2E-204".
 *
 * Nota de aislamiento: global-setup hace upsert de E2E_AVAILABLE_TRIP_ID en
 * cada ejecución completa de la suite (estado + conductor_id reseteados),
 * por lo que el test de aceptación es repetible entre corridas de CI, pero
 * dentro de una misma corrida el orden importa: el test que acepta el viaje
 * debe ejecutarse después del que solo lo consulta. Por eso el describe se
 * corre en modo serie.
 */

const AVAILABLE_TRIP_ID = "00000000-0000-4000-8000-00000000e204";
const ACTIVE_TRIP_ID = "00000000-0000-4000-8000-00000000e205";

test.describe.configure({ mode: "serial" });

test.describe("Cierre REPORTE_ERRORES_E2E — Flujo de oportunidades y traslados", () => {
  test("1. Lista viajes disponibles y muestra el detalle real de una oportunidad", async ({ page }) => {
    await page.goto("/viajes?vista=disponibles");

    // La pestaña "Ofertas" debe estar activa por defecto en esta vista.
    const tabOfertas = page.getByRole("tab", { name: /^Ofertas/ });
    await expect(tabOfertas).toHaveAttribute("aria-selected", "true");

    // Debe existir exactamente la oportunidad fixture, con su ruta real
    // (no un mensaje de estado vacío ni un placeholder).
    await expect(page.getByText(/1 oferta disponible/i)).toBeVisible();
    await expect(page.getByText(/Plaza de la Constitución/i)).toBeVisible();
    await expect(page.getByText(/Santa Fe|Vasco de Quiroga/i)).toBeVisible();

    // Expandir a detalle vía el CTA real de la tarjeta (no un selector genérico).
    await page.getByRole("link", { name: /Ver oferta/i }).click();
    await expect(page).toHaveURL(new RegExp(`/viajes/${AVAILABLE_TRIP_ID}`));

    // El detalle de una oportunidad (aún no aceptada) debe mostrar origen,
    // destino y el CTA de aceptar — y NO debe mostrar controles operativos
    // de un traslado ya asignado (p. ej. "INICIAR TRASLADO").
    await expect(page.getByText(/Plaza de la Constitución/i)).toBeVisible();
    await expect(page.getByText(/Santa Fe|Vasco de Quiroga/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /ACEPTAR TRASLADO/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /INICIAR TRASLADO/i })).toHaveCount(0);
  });

  test("2. Aceptar un viaje disponible lo mueve de 'Ofertas' a 'Aceptados'", async ({ page }) => {
    await page.goto(`/viajes/${AVAILABLE_TRIP_ID}?volver=${encodeURIComponent("/viajes?vista=disponibles")}`);

    const btnAceptar = page.getByRole("button", { name: /ACEPTAR TRASLADO/i });
    await expect(btnAceptar).toBeEnabled();
    await btnAceptar.click();

    // Confirmación explícita de éxito (no silenciar con .catch).
    await expect(page.getByText(/Traslado aceptado con éxito/i)).toBeVisible();

    // Redirección real a "mis viajes" tras aceptar.
    await page.waitForURL(/\/viajes\?vista=mis-viajes/, { timeout: 10_000 });
    const tabAceptados = page.getByRole("tab", { name: /^Aceptados/ });
    await expect(tabAceptados).toHaveAttribute("aria-selected", "true");

    // El viaje recién aceptado ya no debe figurar como oportunidad disponible.
    await page.goto("/viajes?vista=disponibles");
    await expect(page.getByText(/Sin traslados para este día/i)).toBeVisible();
    await expect(page.getByText(/No hay ofertas programadas en esta fecha/i)).toBeVisible();
  });

  test("3. Lista 'mis viajes' con el traslado asignado y navega a su detalle", async ({ page }) => {
    await page.goto("/viajes?vista=mis-viajes");

    const tabAceptados = page.getByRole("tab", { name: /^Aceptados/ });
    await expect(tabAceptados).toHaveAttribute("aria-selected", "true");

    // El traslado fixture ya asignado (evidencia_inicial_en_proceso) debe
    // aparecer con el badge de estado correspondiente a esa etapa.
    await expect(page.getByText(/EN PUNTO DE ORIGEN/i)).toBeVisible();

    // Navegar a su detalle mediante el CTA real de la tarjeta asignada.
    await page.getByRole("link", { name: /INICIAR TRASLADO/i }).first().click();
    await expect(page).toHaveURL(new RegExp(`/viajes/${ACTIVE_TRIP_ID}`));
  });

  test("4. El detalle de un traslado asignado refleja su etapa real del ciclo de vida", async ({ page }) => {
    // Navegación directa por URL para validar el mapeo estado→pantalla de
    // forma aislada, sin depender de la lista.
    await page.goto(`/viajes/${ACTIVE_TRIP_ID}?volver=${encodeURIComponent("/viajes?vista=mis-viajes")}`);

    // estado "evidencia_inicial_en_proceso" debe renderizar
    // LocalizarVehiculoDetails (localizar/recibir el vehículo en origen),
    // con los datos reales del vehículo fixture — no la pantalla de
    // oportunidad ni la de "dirígete al origen".
    await expect(page.getByText(/VEHÍCULO A LOCALIZAR/i)).toBeVisible();
    await expect(page.getByText(/E2E-204/)).toBeVisible();
    await expect(page.getByText(/RAV4 E2E/i)).toBeVisible();

    // No debe mostrar controles de una oportunidad sin asignar.
    await expect(page.getByRole("button", { name: /ACEPTAR TRASLADO/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /RECHAZAR TRASLADO/i })).toHaveCount(0);
  });
});
