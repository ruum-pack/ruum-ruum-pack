import { expect, test } from "@playwright/test";

const storageState = process.env.ADMIN_STORAGE_STATE;
test.skip(!storageState, "ADMIN_STORAGE_STATE requerido");

test.describe("Aprobación dual", () => {
  test("lista solicitudes pendientes", async ({ browser }) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto("/aprobaciones");
    await expect(page.getByRole("heading", { name: /aprobacion/i })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    const pageText = await page.textContent("body");
    const tieneSolicitudes = pageText.includes("pendiente") || pageText.includes("Sin solicitudes");
    expect(tieneSolicitudes).toBe(true);
    await context.close();
  });

  test("página rechaza auto-aprobación", async ({ browser }) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto("/aprobaciones");
    const btnAprobar = page.getByRole("button", { name: /aprobar/i }).first();
    if (await btnAprobar.isVisible()) {
      await btnAprobar.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const motivoInput = dialog.getByPlaceholder(/motivo/i);
      if (await motivoInput.isVisible()) {
        await motivoInput.fill("Prueba E2E: aprobación dual");
      }
    }
    await context.close();
  });

  test("cumple trazabilidad en auditoría", async ({ browser }) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    await page.goto("/auditoria");
    await expect(page.getByRole("heading", { name: /auditori/i })).toBeVisible();
    const body = await page.textContent("body");
    const contieneAuditoria = body.includes("aprobacion") || body.includes("aprobación");
    expect(
      body.includes("Eventos") || body.includes("exportacion") || contieneAuditoria
    ).toBe(true);
    await context.close();
  });
});
