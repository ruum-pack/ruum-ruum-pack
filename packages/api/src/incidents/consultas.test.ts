import { describe, expect, it, vi } from "vitest";
import {
  asignarIncidenciaAdmin,
  escalarIncidenciaAdmin,
  listarHistorialIncidencia,
  listarIncidenciasTorre,
  resolverIncidenciaAdmin
} from "./consultas";

const INCIDENCIA = "00000000-0000-0000-0000-000000000001";
const ADMIN = "00000000-0000-0000-0000-000000000002";

describe("incidents gestión (Fase 11)", () => {
  it("resolver valida UUID antes de llamar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(resolverIncidenciaAdmin(cliente as never, "no-uuid")).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("resolver delega con motivo y severidad", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await resolverIncidenciaAdmin(cliente as never, INCIDENCIA, "Grúa en camino", "high");
    expect(cliente.rpc).toHaveBeenCalledWith(
      "resolver_incidencia",
      expect.objectContaining({ p_incidencia_id: INCIDENCIA, p_severidad: "high" })
    );
  });

  it("asignar delega responsable y severidad", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await asignarIncidenciaAdmin(cliente as never, INCIDENCIA, ADMIN, "critical");
    expect(cliente.rpc).toHaveBeenCalledWith(
      "asignar_incidencia",
      expect.objectContaining({ p_admin_id: ADMIN, p_severidad: "critical" })
    );
  });

  it("escalar exige motivo mínimo", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(escalarIncidenciaAdmin(cliente as never, INCIDENCIA, "x")).rejects.toThrow(/motivo/i);
    expect(cliente.rpc).not.toHaveBeenCalled();
    const ok = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await escalarIncidenciaAdmin(ok as never, INCIDENCIA, "Requiere grúa urgente");
    expect(ok.rpc).toHaveBeenCalledWith("escalar_incidencia", expect.any(Object));
  });

  it("historial ordena cronológico y mapea torre con defaults", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    await expect(listarHistorialIncidencia(cliente as never, INCIDENCIA)).resolves.toEqual([]);
    expect(eq).toHaveBeenCalledWith("incidencia_id", INCIDENCIA);
  });

  it("listarIncidenciasTorre mapea fila legacy sin columnas nuevas", async () => {
    const fila = { id: "i1", traslado_id: "t1" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "a1" }, error: null });
    const order = vi.fn().mockResolvedValue({ data: [fila], error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ order }) });
    const cliente = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      from
    };
    const lista = await listarIncidenciasTorre(cliente as never);
    expect(lista[0]).toMatchObject({ severidad: "medium", estado: "abierta", nivel_escalamiento: 0 });
  });
});
