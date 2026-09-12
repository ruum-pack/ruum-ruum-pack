import { describe, expect, it, vi } from "vitest";
import {
  listarFotosEvidencia,
  listarPagosTraslado,
  obtenerConductorTraslado,
  obtenerResumenTraslado,
  obtenerTrasladosPorIds,
  obtenerVehiculoTraslado
} from "./pasaporte";

const ID = "00000000-0000-0000-0000-000000000001";

function clienteUno(data: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null })
        })
      })
    })
  };
}

function clienteVarios(data: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error: null })
        }),
        in: vi.fn().mockResolvedValue({ data, error: null })
      })
    })
  };
}

describe("transfers pasaporte (Fase 6)", () => {
  it("devuelve null ante error en lectura única", async () => {
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("db") })
          })
        })
      })
    };
    await expect(obtenerResumenTraslado(cliente as never, ID)).resolves.toBeNull();
  });

  it("devuelve [] ante error en listados", async () => {
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error("db") })
          })
        })
      })
    };
    await expect(listarFotosEvidencia(cliente as never, ID)).resolves.toEqual([]);
    await expect(listarPagosTraslado(cliente as never, ID)).resolves.toEqual([]);
  });

  it("no consulta sin ids", async () => {
    const cliente = { from: vi.fn() };
    await expect(obtenerTrasladosPorIds(cliente as never, [])).resolves.toEqual([]);
    await expect(obtenerVehiculoTraslado(cliente as never, null)).resolves.toBeNull();
    await expect(obtenerConductorTraslado(cliente as never, null)).resolves.toBeNull();
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("mapea filas a los tipos del pasaporte", async () => {
    const resumen = { origen_ciudad: "CDMX" };
    await expect(obtenerResumenTraslado(clienteUno(resumen) as never, ID)).resolves.toEqual(resumen);
    const filas = [{ id: ID }];
    await expect(obtenerTrasladosPorIds(clienteVarios(filas) as never, [ID])).resolves.toEqual(filas);
  });
});
