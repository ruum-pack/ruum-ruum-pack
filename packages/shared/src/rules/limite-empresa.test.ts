import { describe, it, expect } from "vitest";
import { puedeAgregarMiembroEmpresa } from "./limite-empresa";

describe("puedeAgregarMiembroEmpresa", () => {
  it("permite agregar un titular_empresa si la empresa no tiene ninguno", () => {
    expect(puedeAgregarMiembroEmpresa([], "titular_empresa")).toBe(true);
  });

  it("permite agregar un usuario_autorizado si ya hay un titular_empresa", () => {
    const miembros = [{ rol: "titular_empresa" as const }];
    expect(puedeAgregarMiembroEmpresa(miembros, "usuario_autorizado")).toBe(true);
  });

  it("rechaza un segundo titular_empresa", () => {
    const miembros = [{ rol: "titular_empresa" as const }];
    expect(puedeAgregarMiembroEmpresa(miembros, "titular_empresa")).toBe(false);
  });

  it("rechaza un segundo usuario_autorizado", () => {
    const miembros = [{ rol: "usuario_autorizado" as const }];
    expect(puedeAgregarMiembroEmpresa(miembros, "usuario_autorizado")).toBe(false);
  });

  it("rechaza agregar más miembros cuando ya hay titular + autorizado (los 2 máximos)", () => {
    const miembros = [{ rol: "titular_empresa" as const }, { rol: "usuario_autorizado" as const }];
    expect(puedeAgregarMiembroEmpresa(miembros, "titular_empresa")).toBe(false);
    expect(puedeAgregarMiembroEmpresa(miembros, "usuario_autorizado")).toBe(false);
  });
});
