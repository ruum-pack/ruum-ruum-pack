import { describe, expect, it, vi } from "vitest";
import { obtenerFinanzasOperacion } from "./finanzas-operacion";

const OPERACION = "00000000-0000-0000-0000-000000000001";

const RESPUESTA = {
  operacion_id: OPERACION,
  traslados: 2,
  facturado: 1000,
  costo_conductor: 600,
  gastos_directos: 100,
  comisiones: 36,
  margen_contribucion: 264,
  traslados_sin_pago: ["00000000-0000-0000-0000-000000000002"]
};

describe("billing finanzas por operación (Fase 12)", () => {
  it("valida UUID antes de llamar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(obtenerFinanzasOperacion(cliente as never, "no-uuid")).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("mapea el agregado del RPC", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: RESPUESTA, error: null }) };
    await expect(obtenerFinanzasOperacion(cliente as never, OPERACION)).resolves.toEqual(RESPUESTA);
    expect(cliente.rpc).toHaveBeenCalledWith(
      "admin_finanzas_operacion",
      expect.objectContaining({ p_operacion_id: OPERACION })
    );
  });

  it("propaga el error del RPC", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("PERMISO_INSUFICIENTE") }) };
    await expect(obtenerFinanzasOperacion(cliente as never, OPERACION)).rejects.toThrow(
      /PERMISO_INSUFICIENTE/
    );
  });

  it("rechaza respuesta nula o malformada", async () => {
    const nula = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await expect(obtenerFinanzasOperacion(nula as never, OPERACION)).rejects.toThrow();
    const mala = { rpc: vi.fn().mockResolvedValue({ data: { facturado: "mucho" }, error: null }) };
    await expect(obtenerFinanzasOperacion(mala as never, OPERACION)).rejects.toThrow();
  });
});
