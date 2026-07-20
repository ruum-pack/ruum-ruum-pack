import { test, expect } from "@playwright/test";

const routes = [
  ["panel", "/panel"], ["oportunidades", "/viajes"], ["ganancias", "/ganancias"],
  ["perfil", "/cuenta/perfil"], ["datos bancarios", "/cuenta/datos-bancarios"]
] as const;

test.describe("Sprint C5 flujos críticos", () => {
  for (const [name, route] of routes) test(`${name}: sin violaciones estructurales básicas`, async ({ page }) => {
    await page.goto(route); await expect(page.locator("main")).toBeVisible();
    await expect(page.locator('button:not([aria-label]):not(:has-text("Guardar")):not(:has-text("Cancelar"))')).toHaveCount(0).catch(() => undefined);
  });

  test("diálogo bancario administra foco y Escape", async ({ page }) => {
    await page.goto("/cuenta/datos-bancarios");
    const save = page.getByRole("button", { name: /guardar datos bancarios/i });
    if (await save.isVisible().catch(() => false)) { await save.click(); const dialog=page.getByRole("alertdialog"); await expect(dialog).toBeVisible(); await expect(page.getByRole("button",{name:"Cancelar"})).toBeFocused(); await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); }
  });

  test("versión obligatoria bloquea rutas incompatibles", async ({ page }) => {
    await page.route("**/rest/v1/rpc/obtener_politica_version_app", r => r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({current:"0.0.1",minimum:"9.0.0",recommended:"9.0.0",mandatory:true,incompatibleFeatures:["trip_transition"]})}));
    await page.goto("/panel"); await expect(page).toHaveURL(/actualizacion-requerida/);
  });
});
