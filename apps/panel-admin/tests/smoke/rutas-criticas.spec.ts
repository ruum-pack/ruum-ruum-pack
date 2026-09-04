import { expect, test } from "@playwright/test";

const rutasCriticas = [
  { ruta: "/", titulo: "Dashboard operativo", texto: "Datos no disponibles" },
  { ruta: "/viajes", titulo: "Traslados", tabla: "Lista de traslados operativos" },
  { ruta: "/tarifas", titulo: "Tarifas", texto: "Fórmula vigente" },
  { ruta: "/mapa", titulo: "Mapa operativo", texto: "Sin traslados activos" }
];

test.describe("panel-admin rutas críticas", () => {
  for (const caso of rutasCriticas) {
    test(`${caso.ruta} renderiza sin sesión real`, async ({ page }) => {
      await page.goto(caso.ruta, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: caso.titulo, exact: true })).toBeVisible();
      if ("tabla" in caso) {
        await expect(page.getByRole("table", { name: caso.tabla })).toBeVisible();
      } else {
        await expect(page.getByText(caso.texto).first()).toBeVisible();
      }
    });
  }

  test("/metricas-registro falla de forma visible sin Supabase configurado", async ({ page }) => {
    await page.goto("/metricas-registro", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Métricas de registro" })).toBeVisible();
    await expect(page.getByText("Supabase no está configurado")).toBeVisible();
  });
});
