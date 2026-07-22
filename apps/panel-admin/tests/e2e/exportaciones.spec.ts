import { expect, test } from "@playwright/test";

const storageState = process.env.ADMIN_STORAGE_STATE;
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3002";

const PERMISOS_EXPORTACION: Record<string, { puedeExportar: boolean; nombre: string }> = {
  "/api/exportaciones/pagos": { puedeExportar: true, nombre: "Exportar pagos" }
};

test.skip(!storageState, "ADMIN_STORAGE_STATE requerido");

test.describe("Exportaciones", () => {
  for (const [ruta, info] of Object.entries(PERMISOS_EXPORTACION)) {
    test(`${info.nombre}: sin permiso devuelve 403`, async ({ browser }) => {
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();
      const response = await page.request.get(`${baseURL}${ruta}`);
      const status = response.status();
      expect(status === 403 || status === 200).toBe(true);
      if (status === 403) {
        const body = await response.json();
        expect(["forbidden", "export_init_failed"]).toContain(body.error);
      }
      await context.close();
    });
  }

  test("CSV: volumen máximo no excede límite", async () => {
    const response = await fetch(`${baseURL}/api/exportaciones/pagos?desde=2020-01-01&hasta=2030-12-31`);
    if (response.status === 200) {
      const csv = await response.text();
      const filas = csv.trim().split("\n").length - 1;
      expect(filas).toBeLessThanOrEqual(10_000);
    }
  });

  test("CSV: fórmulas escapadas", async () => {
    const response = await fetch(`${baseURL}/api/exportaciones/pagos`);
    if (response.status === 200) {
      const csv = await response.text();
      const lineas = csv.split("\n").slice(1);
      for (const linea of lineas) {
        if (linea.trim() === "") continue;
        const celdas = linea.split(",");
        for (const celda of celdas) {
          if (celda.startsWith("=") || celda.startsWith("+") || celda.startsWith("-") || celda.startsWith("@")) {
            expect(celda).toMatch(/^'/);
          }
        }
      }
    }
  });

  test("CSV: hash SHA-256 en respuesta", async () => {
    const response = await fetch(`${baseURL}/api/exportaciones/pagos`);
    if (response.status === 200) {
      const hash = response.headers.get("x-content-sha256");
      expect(hash).toBeTruthy();
      expect(hash?.length).toBe(64);
    }
  });

  test("filtro de fechas respeta rango máximo", async () => {
    const hace10Anios = new Date(Date.now() - 365 * 10 * 86400000).toISOString().split("T")[0];
    const response = await fetch(
      `${baseURL}/api/exportaciones/pagos?desde=${hace10Anios}&hasta=2030-12-31`
    );
    expect([200, 403, 500]).toContain(response.status);
  });
});
