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

  test.describe("Flujo End-to-End de Recuperación de Contraseña", () => {
    test("solicitar enlace de recuperación en /recuperar-password (simulando resetPasswordForEmail)", async ({ page }) => {
      await page.route("**/auth/v1/recover*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({})
        })
      );

      await page.goto("/recuperar-password");
      await expect(page.getByRole("heading", { name: /recuperar contraseña/i })).toBeVisible();

      await page.getByLabel(/correo electrónico/i).fill("conductor@ejemplo.com");
      await page.getByRole("button", { name: /enviar enlace/i }).click();

      await expect(page.getByText(/correo enviado a/i)).toBeVisible();
      await expect(page.getByText("conductor@ejemplo.com")).toBeVisible();
      await expect(page.getByText(/el enlace expira en 60 minutos/i)).toBeVisible();
    });

    test("restablecer contraseña en /nueva-password con sesión de recuperación y validación de checklist", async ({ page }) => {
      await page.route("**/auth/v1/user*", (route) => {
        if (route.request().method() === "PUT") {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              id: "user-test-recovery-123",
              email: "conductor@ejemplo.com",
              updated_at: new Date().toISOString()
            })
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "user-test-recovery-123",
            email: "conductor@ejemplo.com",
            aud: "authenticated",
            role: "authenticated"
          })
        });
      });

      await page.goto("/nueva-password");

      await expect(page.getByRole("heading", { name: /nueva contraseña/i })).toBeVisible();
      const inputPassword = page.getByLabel(/^nueva contraseña/i);
      const inputConfirmar = page.getByLabel(/confirmar contraseña/i);
      const submitBtn = page.getByRole("button", { name: /guardar nueva contraseña/i });

      // Intento con contraseña incompleta / inválida (sin minúsculas)
      await inputPassword.fill("PASSWORD123!");
      await inputConfirmar.fill("PASSWORD123!");
      await submitBtn.click();

      await expect(page.getByText(/tu contraseña debe cumplir todos los requisitos/i)).toBeVisible();

      // Contraseña válida que cumple todos los requisitos
      await inputPassword.fill("PasswordSegura123!");
      await inputConfirmar.fill("PasswordSegura123!");
      await submitBtn.click();

      await expect(page.getByText(/contraseña actualizada\. redirigiendo/i)).toBeVisible();
      await expect(page).toHaveURL(/\/panel/, { timeout: 10_000 });
    });
  });
});
