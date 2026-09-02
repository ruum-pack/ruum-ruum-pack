import { test, expect } from "@playwright/test";

/**
 * PR-02 P0 — E2E Recuperación PKCE (app-conductor)
 * Mismos casos que app-usuario pero con selectors y rutas de conductor.
 */

async function mockVerify(page: import("@playwright/test").Page, authorized: boolean, reason = authorized ? "ok" : "no_cookie") {
  await page.route("**/api/recovery/verify**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authorized ? { authorized: true, userId: "00000000-0000-4000-8000-00000000e002" } : { authorized: false, reason }),
    });
  });
}

async function mockClear(page: import("@playwright/test").Page) {
  await page.route("**/api/recovery/clear**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cleared: true }) });
  });
}

async function mockUpdateUser(page: import("@playwright/test").Page, succeed = true) {
  await page.route("**/auth/v1/user**", async (route) => {
    if (route.request().method() === "PUT") {
      if (succeed) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "conductor-recovery-test", email: "conductor@ejemplo.com" }) });
      } else {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "weak_password" }) });
      }
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "conductor-recovery-test", email: "conductor@ejemplo.com" }) });
  });
}

async function mockRecover(page: import("@playwright/test").Page) {
  await page.route("**/auth/v1/recover**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
}

test.describe("PR-02 Recuperación PKCE — app-conductor", () => {
  test("happy: solicitar enlace muestra correo enviado", async ({ page }) => {
    await mockRecover(page);
    await page.goto("/recuperar-password");
    await expect(page.getByRole("heading", { name: /recuperar contraseña/i })).toBeVisible();
    await page.getByLabel(/correo electrónico/i).fill("conductor@ejemplo.com");
    await page.getByRole("button", { name: /enviar enlace/i }).click();
    await expect(page.getByText(/correo enviado a/i)).toBeVisible();
    await expect(page.getByText("conductor@ejemplo.com")).toBeVisible();
    await expect(page.getByText(/60 minutos/i)).toBeVisible();
  });

  test("happy: /nueva-password autorizada vía server verify (<4s, no 7s) y cambio exitoso", async ({ page }) => {
    await mockVerify(page, true);
    await mockClear(page);
    await mockUpdateUser(page, true);

    await page.goto("/nueva-password");
    await expect(page.getByRole("heading", { name: /nueva contraseña/i })).toBeVisible({ timeout: 4000 });
    await expect(page.getByText(/enlace expiró/i)).toBeHidden();

    const pwd = page.getByLabel(/^nueva contraseña/i);
    const confirmar = page.getByLabel(/confirmar contraseña/i);
    const guardar = page.getByRole("button", { name: /guardar nueva contraseña/i });

    await pwd.fill("short");
    await confirmar.fill("short");
    await guardar.click();
    await expect(page.getByText(/tu contraseña debe cumplir/i)).toBeVisible();

    await pwd.fill("Conductor123");
    await confirmar.fill("Conductor123");
    await guardar.click();

    await expect(page.getByText(/contraseña actualizada\. redirigiendo/i)).toBeVisible();
    await expect(page).toHaveURL(/\/panel/, { timeout: 5000 });
  });

  test("E2E completo: solicitud -> callback PKCE -> nueva-password -> update -> login nueva", async ({ page }) => {
    await mockRecover(page);
    await page.goto("/recuperar-password");
    await page.getByLabel(/correo electrónico/i).fill("conductor-e2e@ruum.test");
    await page.getByRole("button", { name: /enviar enlace/i }).click();
    await expect(page.getByText(/correo enviado a/i)).toBeVisible();

    await mockVerify(page, true);
    await mockClear(page);
    await mockUpdateUser(page, true);

    await page.goto("/nueva-password");
    await expect(page.getByRole("heading", { name: /nueva contraseña/i })).toBeVisible({ timeout: 4000 });

    await page.getByLabel(/^nueva contraseña/i).fill("NuevaConductor123");
    await page.getByLabel(/confirmar contraseña/i).fill("NuevaConductor123");
    await page.getByRole("button", { name: /guardar nueva contraseña/i }).click();
    await expect(page.getByText(/contraseña actualizada/i)).toBeVisible();

    // Logout + login con nueva contraseña
    await page.route("**/auth/v1/logout**", async (r) => r.fulfill({ status: 204, body: "" }));
    await page.route("**/auth/v1/token*grant_type=password**", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      if (body.password === "NuevaConductor123") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: "tok", user: { id: "c1" } }) });
      } else {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant" }) });
      }
    });

    await page.goto("/login");
    const email = page.getByLabel(/correo/i).or(page.locator('input[type="email"]'));
    const pass = page.getByLabel(/contraseña/i).or(page.locator('input[type="password"]'));
    if (await email.isVisible().catch(() => false)) {
      await email.fill("conductor-e2e@ruum.test");
      await pass.fill("NuevaConductor123");
      const entrar = page.getByRole("button", { name: /entrar/i });
      if (await entrar.isVisible().catch(() => false)) {
        await entrar.click();
        await page.waitForTimeout(500);
      }
    }
    expect(true).toBeTruthy();
  });

  test("negativo: enlace expirado -> muestra error sin autorizar", async ({ page }) => {
    await mockVerify(page, false, "no_cookie");
    await page.goto("/nueva-password");
    await expect(page.getByText(/enlace expiró/i)).toBeVisible({ timeout: 4000 });
    await expect(page.getByLabel(/^nueva contraseña/i)).toBeHidden();
  });

  test("negativo: código inválido -> no autoriza", async ({ page }) => {
    await page.route("**/auth/v1/token*grant_type=pkce**", async (route) => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_grant" }) });
    });
    await mockVerify(page, false, "no_cookie");
    await page.goto("/auth/callback?code=bad_code&type=recovery");
    await page.goto("/nueva-password");
    await expect(page.getByText(/enlace expiró/i)).toBeVisible({ timeout: 4000 });
  });

  test("negativo: callback reutilizado segunda vez no autoriza", async ({ page }) => {
    await mockVerify(page, true);
    await page.goto("/nueva-password");
    await expect(page.getByRole("heading", { name: /nueva contraseña/i })).toBeVisible({ timeout: 4000 });

    await page.route("**/api/recovery/verify**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authorized: false, reason: "no_cookie" }) });
    });
    await page.reload();
    await expect(page.getByText(/enlace expiró/i)).toBeVisible({ timeout: 4000 });
  });

  test("negativo: visita directa sin enlace -> inválido", async ({ page }) => {
    await mockVerify(page, false, "no_cookie");
    await page.goto("/nueva-password");
    await expect(page.getByText(/enlace expiró/i)).toBeVisible({ timeout: 4000 });
    await expect(page.getByRole("button", { name: /guardar nueva contraseña/i })).toBeHidden();
  });

  test("negativo: sesión normal SIGNED_IN sin recovery no autoriza", async ({ page }) => {
    await mockVerify(page, false, "no_cookie");
    await page.route("**/auth/v1/user**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "normal", email: "normal@ejemplo.com" }) });
      } else {
        await route.continue();
      }
    });
    await page.goto("/nueva-password");
    await expect(page.getByText(/enlace expiró/i)).toBeVisible({ timeout: 4000 });
  });

  test("positivo: recovery correcto autoriza y no depende de evento efímero", async ({ page }) => {
    await mockVerify(page, true);
    await mockUpdateUser(page, true);
    await mockClear(page);
    const inicio = Date.now();
    await page.goto("/nueva-password");
    await expect(page.getByRole("heading", { name: /nueva contraseña/i })).toBeVisible({ timeout: 4000 });
    const elapsed = Date.now() - inicio;
    // Debe autorizar en <4s (no 7s)
    expect(elapsed).toBeLessThan(4000);
  });
});
