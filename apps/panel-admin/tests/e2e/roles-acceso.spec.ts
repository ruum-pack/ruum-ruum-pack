import { expect, test } from "@playwright/test";

const storageState = process.env.ADMIN_STORAGE_STATE;
test.skip(!storageState, "ADMIN_STORAGE_STATE debe apuntar a una sesión administrativa real");

type RolPrueba = {
  rol: string;
  archivoSesion: string;
  rutasPermitidas: string[];
  rutasDenegadas: string[];
};

const ROLES: RolPrueba[] = [
  {
    rol: "operador",
    archivoSesion: "storageState-operador.json",
    rutasPermitidas: ["/", "/viajes", "/masivos", "/mapa", "/alertas-sla", "/conductores", "/incidencias"],
    rutasDenegadas: ["/auditoria", "/aprobaciones", "/pagos", "/tarifas", "/reportes", "/disputas", "/capacidades", "/usuarios", "/empresas", "/configuracion", "/metricas-registro"]
  },
  {
    rol: "supervisor",
    archivoSesion: "storageState-supervisor.json",
    rutasPermitidas: ["/", "/viajes", "/masivos", "/mapa", "/alertas-sla", "/conductores", "/metricas-registro", "/incidencias", "/disputas", "/documentos", "/reportes", "/auditoria", "/aprobaciones"],
    rutasDenegadas: ["/pagos", "/tarifas", "/capacidades", "/configuracion", "/usuarios", "/empresas", "/reclamos-seguro"]
  },
  {
    rol: "finanzas",
    archivoSesion: "storageState-finanzas.json",
    rutasPermitidas: ["/", "/viajes", "/pagos", "/tarifas", "/reportes", "/disputas", "/reclamos-seguro"],
    rutasDenegadas: ["/auditoria", "/aprobaciones", "/capaciades", "/masivos", "/conductores", "/incidencias", "/alertas-sla", "/documentos", "/empresas", "/usuarios", "/metricas-registro", "/configuracion"]
  },
  {
    rol: "compliance",
    archivoSesion: "storageState-compliance.json",
    rutasPermitidas: ["/", "/alertas-sla", "/documentos", "/incidencias", "/usuarios", "/conductores", "/empresas", "/reclamos-seguro", "/reportes", "/auditoria", "/aprobaciones"],
    rutasDenegadas: ["/pagos", "/tarifas", "/capacidades", "/configuracion", "/masivos", "/viajes", "/disputas"]
  },
  {
    rol: "direccion",
    archivoSesion: "storageState-direccion.json",
    rutasPermitidas: ["/", "/viajes", "/mapa", "/alertas-sla", "/reportes", "/pagos", "/tarifas", "/incidencias", "/disputas", "/reclamos-seguro", "/auditoria", "/aprobaciones", "/masivos", "/conductores", "/usuarios", "/vehiculos", "/empresas", "/documentos", "/configuracion", "/capacidades", "/metricas-registro"],
    rutasDenegadas: []
  }
];

for (const rol of ROLES) {
  test.describe(`Rol: ${rol.rol}`, () => {
    for (const ruta of rol.rutasPermitidas) {
      test(`accede a ${ruta}`, async ({ browser }) => {
        const context = await browser.newContext({ storageState });
        const page = await context.newPage();
        await page.goto(ruta);
        await expect(page).not.toHaveURL(/login/);
        await expect(page).not.toHaveURL(/sin-permiso/);
        await expect(page.getByRole("main")).toBeVisible();
        await context.close();
      });
    }

    for (const ruta of rol.rutasDenegadas) {
      test(`bloquea ${ruta} → /sin-permiso`, async ({ browser }) => {
        const context = await browser.newContext({ storageState });
        const page = await context.newPage();
        await page.goto(ruta);
        await expect(page).toHaveURL(/sin-permiso/);
        await context.close();
      });
    }
  });
}

test.describe("Rol: sesión expirada o inválida", () => {
  test("redirige a /login sin sesión", async ({ page }) => {
    await page.goto("/viajes");
    await expect(page).toHaveURL(/login/);
  });

  test("redirige a /login con sesión inválida", async ({ page }) => {
    await page.addInitScript(() => {
      document.cookie = "sb-auth-token=invalido; path=/";
    });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});
