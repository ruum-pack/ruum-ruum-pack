import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PANEL_FILE = readFileSync(
  resolve(__dirname, "../src/app/panel/page.tsx"),
  "utf8"
);

const CUENTA_FILE = readFileSync(
  resolve(__dirname, "../src/app/cuenta/page.tsx"),
  "utf8"
);

describe("Botones de Cerrar Sesión - Panel y Cuenta", () => {
  it("incluye el botón de cerrar sesión en el panel", () => {
    expect(PANEL_FILE).toContain("useCerrarSesion");
    expect(PANEL_FILE).toContain('aria-label="Cerrar sesión"');
    expect(PANEL_FILE).toContain("cerrarSesion()");
    expect(PANEL_FILE).toContain("cerrandoSesion");
  });

  it("incluye el botón de cerrar sesión en cuenta (cabecera y sección destacada)", () => {
    expect(CUENTA_FILE).toContain("useCerrarSesion");
    expect(CUENTA_FILE).toContain("Cerrar sesión activa");
    expect(CUENTA_FILE).toContain("Cerrar Sesión Activa");
    expect(CUENTA_FILE).toContain("cerrarSesion()");
    expect(CUENTA_FILE).toContain("cerrandoSesion");
  });
});
