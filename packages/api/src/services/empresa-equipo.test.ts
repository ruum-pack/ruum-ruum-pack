import { describe, expect, it, vi } from "vitest";
import {
  cambiarRolMiembro,
  crearSucursal,
  invitarMiembro,
  listarMiembros,
  listarRoles,
  removerMiembro
} from "./empresa-equipo";

describe("empresa-equipo service", () => {
  it("listarRoles combina roles con sus permisos", async () => {
    const orderRoles = vi.fn().mockResolvedValue({
      data: [{ clave: "viewer", nombre: "Viewer", descripcion: null, es_sistema: true }],
      error: null
    });
    const orderPermisos = vi.fn().mockResolvedValue({
      data: [{ rol_clave: "viewer", permiso: "operation:view" }],
      error: null
    });
    let llamada = 0;
    const cliente = {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: (...a: unknown[]) => {
            llamada += 1;
            return llamada === 1 ? orderRoles(...a) : orderPermisos(...a);
          }
        })
      }))
    };
    const roles = await listarRoles(cliente as never);
    expect(roles).toHaveLength(1);
    expect(roles[0].permisos).toEqual(["operation:view"]);
  });

  it("listarMiembros enriquece con nombre de usuario", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: "m1", rol_clave: "owner", usuarios: { nombre: "Titular" } }],
      error: null
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    const miembros = await listarMiembros(cliente as never, "00000000-0000-0000-0000-000000000001");
    expect(miembros[0].usuario_nombre).toBe("Titular");
  });

  it("invitarMiembro valida UUID antes de llamar RPC", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      invitarMiembro(cliente as never, "no-uuid", "00000000-0000-0000-0000-000000000002", "admin")
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("invitarMiembro rechaza rol inválido sin llamar RPC", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      invitarMiembro(
        cliente as never,
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "superadmin" as never
      )
    ).rejects.toThrow(/Rol de empresa inválido/);
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("invitarMiembro ejecuta la RPC y devuelve el id", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: "m-nuevo", error: null }) };
    const id = await invitarMiembro(
      cliente as never,
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "dispatcher"
    );
    expect(id).toBe("m-nuevo");
    expect(cliente.rpc).toHaveBeenCalledWith("empresa_invitar_miembro", expect.any(Object));
  });

  it("cambiarRolMiembro y removerMiembro delegan en RPC", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await cambiarRolMiembro(cliente as never, "00000000-0000-0000-0000-000000000003", "finance");
    await removerMiembro(cliente as never, "00000000-0000-0000-0000-000000000003");
    expect(cliente.rpc).toHaveBeenCalledWith("empresa_cambiar_rol_miembro", expect.any(Object));
    expect(cliente.rpc).toHaveBeenCalledWith("empresa_remover_miembro", expect.any(Object));
  });

  it("crearSucursal rechaza nombre vacío sin tocar DB", async () => {
    const cliente = { from: vi.fn() };
    await expect(
      crearSucursal(cliente as never, "00000000-0000-0000-0000-000000000001", { nombre: "  " })
    ).rejects.toThrow(/obligatorio/);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
