import { describe, expect, it } from "vitest";
import {
  ROL_PERMISOS_EMPRESA,
  ROLES_EMPRESA,
  tienePermisoEmpresa
} from "./empresa-equipo";

describe("modelo de equipo empresa (Fase 2)", () => {
  it("expone los 6 roles iniciales del plan", () => {
    expect(ROLES_EMPRESA).toEqual([
      "owner",
      "admin",
      "operations_manager",
      "dispatcher",
      "finance",
      "viewer"
    ]);
  });

  it("owner y admin tienen team:manage y billing:manage", () => {
    for (const rol of ["owner", "admin"] as const) {
      expect(tienePermisoEmpresa(rol, "team:manage")).toBe(true);
      expect(tienePermisoEmpresa(rol, "billing:manage")).toBe(true);
    }
  });

  it("viewer es solo lectura", () => {
    expect(tienePermisoEmpresa("viewer", "operation:view")).toBe(true);
    expect(tienePermisoEmpresa("viewer", "team:manage")).toBe(false);
    expect(tienePermisoEmpresa("viewer", "transfer:create")).toBe(false);
    expect(tienePermisoEmpresa("viewer", "billing:manage")).toBe(false);
  });

  it("dispatcher asigna conductores pero no ve facturación", () => {
    expect(tienePermisoEmpresa("dispatcher", "driver:assign")).toBe(true);
    expect(tienePermisoEmpresa("dispatcher", "billing:view")).toBe(false);
  });

  it("finance gestiona facturación pero no operaciones", () => {
    expect(tienePermisoEmpresa("finance", "billing:manage")).toBe(true);
    expect(tienePermisoEmpresa("finance", "operation:update")).toBe(false);
  });

  it("matriz espejo: todo permiso listado existe en algún rol", () => {
    const todos = new Set(Object.values(ROL_PERMISOS_EMPRESA).flat());
    expect(todos.has("operation:create")).toBe(true);
    expect(todos.has("reports:view")).toBe(true);
    expect(todos.has("location:manage")).toBe(true);
  });
});
