import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const storageState = process.env.ADMIN_STORAGE_STATE;
test.skip(!storageState, "ADMIN_STORAGE_STATE debe apuntar a una sesión administrativa real y no expirada");

const RUTAS_CRITICAS = [
  "/",
  "/viajes",
  "/viajes/1",
  "/conductores",
  "/conductores/1",
  "/pagos",
  "/tarifas",
  "/incidencias",
  "/disputas",
  "/auditoria",
  "/aprobaciones",
  "/reportes",
  "/mapa",
  "/usuarios",
  "/vehiculos",
  "/empresas",
  "/documentos",
  "/configuracion",
  "/capacidades",
  "/masivos",
  "/reclamos-seguro",
  "/alertas-sla",
  "/metricas-registro"
];

for (const ruta of RUTAS_CRITICAS) {
  test(`sin violaciones críticas con sesión real: ${ruta}`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: storageState! });
    const page = await context.newPage();
    await page.goto(ruta);
    await expect(page).not.toHaveURL(/login/);

    if (await page.getByRole("heading", { name: /sin permiso/i }).isVisible().catch(() => false)) {
      test.info().annotations.push({ type: "skip", description: `Ruta ${ruta} no permitida para este rol` });
      await context.close();
      return;
    }

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const violacionesCriticas = resultado.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (violacionesCriticas.length > 0) {
      console.log(`Violaciones en ${ruta}:`, JSON.stringify(violacionesCriticas, null, 2));
    }

    expect(violacionesCriticas).toEqual([]);
    await context.close();
  });
}
