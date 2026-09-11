import { describe, expect, it, vi } from "vitest";
import {
  aceptarAsignacion,
  listarHistorialAsignaciones,
  ofrecerAsignacion,
  reasignarConductor,
  rechazarAsignacion
} from "./asignaciones";

const UUID_TRASLADO = "00000000-0000-0000-0000-000000000001";
const UUID_CONDUCTOR = "00000000-0000-0000-0000-000000000002";
const UUID_ASIG = "00000000-0000-0000-0000-000000000003";

describe("asignaciones service", () => {
  it("ofrecer valida UUIDs antes de llamar RPC", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(ofrecerAsignacion(cliente as never, "no-uuid", UUID_CONDUCTOR)).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("ofrecer ejecuta la RPC y devuelve el id", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: "a-nueva", error: null }) };
    const id = await ofrecerAsignacion(cliente as never, UUID_TRASLADO, UUID_CONDUCTOR, "Cobertura");
    expect(id).toBe("a-nueva");
    expect(cliente.rpc).toHaveBeenCalledWith("ofrecer_asignacion", expect.objectContaining({ p_motivo: "Cobertura" }));
  });

  it("aceptar/rechazar delegan con el motivo", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await aceptarAsignacion(cliente as never, UUID_ASIG);
    await rechazarAsignacion(cliente as never, UUID_ASIG, "Zona");
    expect(cliente.rpc).toHaveBeenCalledWith("aceptar_asignacion", expect.any(Object));
    expect(cliente.rpc).toHaveBeenCalledWith("rechazar_asignacion", expect.objectContaining({ p_motivo: "Zona" }));
  });

  it("reasignar devuelve la nueva asignación", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: "a-nueva", error: null }) };
    const id = await reasignarConductor(cliente as never, UUID_TRASLADO, UUID_CONDUCTOR, "Descanso");
    expect(id).toBe("a-nueva");
    expect(cliente.rpc).toHaveBeenCalledWith("reasignar_conductor", expect.any(Object));
  });

  it("historial ordena cronológico y propaga errores", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: "a1" }], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    const filas = await listarHistorialAsignaciones(cliente as never, UUID_TRASLADO);
    expect(eq).toHaveBeenCalledWith("traslado_id", UUID_TRASLADO);
    expect(order).toHaveBeenCalledWith("creado_en", { ascending: true });
    expect(filas).toHaveLength(1);

    const orderErr = vi.fn().mockResolvedValue({ data: null, error: new Error("RLS") });
    const clienteErr = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: orderErr }) }) }) };
    await expect(listarHistorialAsignaciones(clienteErr as never, UUID_TRASLADO)).rejects.toThrow("RLS");
  });
});
