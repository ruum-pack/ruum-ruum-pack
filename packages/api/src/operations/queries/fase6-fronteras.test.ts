import { describe, expect, it, vi } from "vitest";
import {
  listarAuditoriaSeguridad,
  listarExportacionesAdmin
} from "./auditoria-seguridad";
import {
  obtenerAdminSesion,
  registrarAccesoDenegado,
  verificarPermisoRuta
} from "./guard-admin";
import { verificarConexionDb, verificarRpcSupabase } from "./salud";

function clientePermiso() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null })
  };
}

function conFrom(base: object, tablas: Record<string, unknown>) {
  return {
    ...base,
    from: vi.fn().mockImplementation((tabla: string) => {
      if (tabla === "admins") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "00000000-0000-0000-0000-000000000001", rol_operativo: "direccion" },
                error: null
              })
            })
          })
        };
      }
      return tablas[tabla];
    })
  };
}

function cadenaTerminal(valor: unknown) {
  const order = { range: vi.fn().mockResolvedValue(valor) };
  const trasFiltro = { order: vi.fn().mockReturnValue(order), or: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue(order) }) };
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(trasFiltro),
      ilike: vi.fn().mockReturnValue(trasFiltro),
      or: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue(order) }),
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue(valor),
        limit: vi.fn().mockResolvedValue(valor)
      })
    })
  };
}

describe("operations auditoria-seguridad y salud (Fase 6)", () => {
  it("pagina auditoría con filtros", async () => {
    const cliente = conFrom(clientePermiso(), {
      auditoria_admin_seguridad: cadenaTerminal({ data: [], error: null, count: 0 })
    });
    await expect(
      listarAuditoriaSeguridad(cliente as never, { page: 1, pageSize: 20, tipo: "denegado", busqueda: "x" })
    ).resolves.toEqual({ eventos: [], total: 0, page: 1, pageSize: 20 });
  });

  it("acota paginación", async () => {
    const cliente = conFrom(clientePermiso(), {
      auditoria_admin_seguridad: cadenaTerminal({ data: [], error: null, count: 0 })
    });
    const res = await listarAuditoriaSeguridad(cliente as never, { page: -5, pageSize: 5000 });
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(100);
  });

  it("lista exportaciones con tope", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
    const cliente = conFrom(clientePermiso(), {
      exportaciones_admin: {
        select: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit }) })
      }
    });
    await expect(listarExportacionesAdmin(cliente as never, 500)).resolves.toEqual({ exportaciones: [], total: 0 });
    expect(limit).toHaveBeenCalled();
  });

  it("salud rpc/db reporta ok y error sin lanzar", async () => {    const okRpc = { rpc: vi.fn().mockResolvedValue({ error: null }) };
    await expect(verificarRpcSupabase(okRpc as never)).resolves.toEqual({ ok: true, mensaje: null });
    const malRpc = { rpc: vi.fn().mockResolvedValue({ error: new Error("caído") }) };
    await expect(verificarRpcSupabase(malRpc as never)).resolves.toEqual({ ok: false, mensaje: "caído" });
    const okDb = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ error: null }) }) }) };
    await expect(verificarConexionDb(okDb as never)).resolves.toEqual({ ok: true, mensaje: null });
    const malDb = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ limit: vi.fn().mockRejectedValue(new Error("x")) }) }) };
    await expect(verificarConexionDb(malDb as never)).resolves.toEqual({ ok: false, mensaje: "x" });
  });

  it("obtiene sesión admin o null", async () => {
    const fila = { id: "00000000-0000-0000-0000-000000000001", rol_operativo: "supervisor" };
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: fila, error: null })
          })
        })
      })
    };
    await expect(obtenerAdminSesion(cliente as never, "u")).resolves.toEqual(fila);
    const vacio = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })
        })
      })
    };
    await expect(obtenerAdminSesion(vacio as never, "u")).resolves.toBeNull();
  });

  it("verifica permiso y registra denegación por RPC validada", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    await expect(verificarPermisoRuta(cliente as never, "viajes:leer")).resolves.toBe(true);
    await registrarAccesoDenegado(cliente as never, { ruta: "/x", metodo: "GET", motivo: "m" });
    expect(cliente.rpc).toHaveBeenCalledWith(
      "registrar_acceso_admin_denegado",
      expect.objectContaining({ p_ruta: "/x" })
    );
  });
});
