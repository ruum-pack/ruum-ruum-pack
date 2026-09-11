import { describe, expect, it, vi } from "vitest";
import { tienePermisoAdmin } from "./permisos-admin";

describe("tienePermisoAdmin (Fase 6)", () => {
  it("devuelve true cuando la RPC confirma", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    await expect(tienePermisoAdmin(cliente as never, "viajes:leer")).resolves.toBe(true);
    expect(cliente.rpc).toHaveBeenCalledWith("admin_tiene_permiso", { p_permiso: "viajes:leer" });
  });

  it("devuelve false cuando la RPC niega (sin lanzar)", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) };
    await expect(tienePermisoAdmin(cliente as never, "viajes:leer")).resolves.toBe(false);
  });

  it("propaga errores de red", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("caído") }) };
    await expect(tienePermisoAdmin(cliente as never, "viajes:leer")).rejects.toThrow("caído");
  });
});
