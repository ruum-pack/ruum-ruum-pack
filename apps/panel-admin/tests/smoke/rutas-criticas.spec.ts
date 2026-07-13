import { expect, test } from "@playwright/test";

const rutasCriticas = [
  { ruta: "/", titulo: "Dashboard Operativo", texto: "Estás viendo datos de ejemplo" },
  { ruta: "/viajes", titulo: "Viajes", texto: "Lista de viajes operativos" },
  { ruta: "/tarifas", titulo: "Tarifas", texto: "Fórmula RT-12" },
  { ruta: "/mapa", titulo: "Mapa operativo", texto: "Modo demo" }
];

test.describe("panel-admin rutas críticas", () => {
  for (const caso of rutasCriticas) {
    test(`${caso.ruta} renderiza sin sesión real`, async ({ page }) => {
      await page.goto(caso.ruta);
      await expect(page.getByRole("heading", { name: caso.titulo })).toBeVisible();
      await expect(page.getByText(caso.texto)).toBeVisible();
    });
  }

  test("/metricas-registro falla de forma visible sin Supabase configurado", async ({ page }) => {
    await page.goto("/metricas-registro");
    await expect(page.getByRole("heading", { name: "Métricas de registro" })).toBeVisible();
    await expect(page.getByText("Supabase no está configurado")).toBeVisible();
  });
});
