import { describe, expect, it, vi } from "vitest";
import {
  eliminarGastoTraslado,
  listarGastosTraslado,
  registrarGastoTraslado
} from "./gastos";
import {
  guardarInspeccionTraslado,
  listarInspeccionesTraslado,
  obtenerInspeccionTraslado
} from "./inspecciones";

const TRASLADO = "00000000-0000-0000-0000-000000000001";

describe("drivers gastos e inspecciones (Fase 6)", () => {
  it("lista gastos ordenados", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const cliente = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order }) }) })
    };
    await expect(listarGastosTraslado(cliente as never, TRASLADO)).resolves.toEqual([]);
    expect(cliente.from).toHaveBeenCalledWith("gastos_traslado");
  });

  it("valida monto antes de registrar", async () => {
    const cliente = { from: vi.fn() };
    await expect(
      registrarGastoTraslado(cliente as never, { trasladoId: TRASLADO, tipo: "caseta", monto: 0 })
    ).rejects.toThrow();
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("registra y elimina gasto", async () => {
    const fila = { id: "g1" };
    const single = vi.fn().mockResolvedValue({ data: fila, error: null });
    const cliente = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
      })
    };
    await expect(
      registrarGastoTraslado(cliente as never, { trasladoId: TRASLADO, tipo: "caseta", monto: 100 })
    ).resolves.toEqual(fila);
    await eliminarGastoTraslado(cliente as never, TRASLADO);
  });

  it("lista y obtiene inspecciones", async () => {
    const filas = [{ tipo: "inicial" }];
    const clienteLista = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: filas, error: null })
        })
      })
    };
    await expect(listarInspeccionesTraslado(clienteLista as never, TRASLADO)).resolves.toEqual(filas);
    const clienteUna = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: filas[0], error: null })
            })
          })
        })
      })
    };
    await expect(obtenerInspeccionTraslado(clienteUna as never, TRASLADO, "inicial")).resolves.toEqual(filas[0]);
  });

  it("guarda inspección idempotente por traslado+tipo", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const cliente = { from: vi.fn().mockReturnValue({ upsert }) };
    await guardarInspeccionTraslado(cliente as never, { traslado_id: TRASLADO, tipo: "inicial", kilometraje: 10 });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ traslado_id: TRASLADO, tipo: "inicial" }),
      { onConflict: "traslado_id,tipo" }
    );
  });

  it("rechaza kilometraje negativo", async () => {
    const cliente = { from: vi.fn() };
    await expect(
      guardarInspeccionTraslado(cliente as never, { traslado_id: TRASLADO, tipo: "final", kilometraje: -1 })
    ).rejects.toThrow();
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
