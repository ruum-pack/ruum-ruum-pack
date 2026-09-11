import { describe, expect, it, vi } from "vitest";
import {
  listarEventosCustodia,
  obtenerReporteCustodia,
  registrarEventoCustodia,
  verificarCadenaCustodia
} from "./custodia";

const TRASLADO = "00000000-0000-0000-0000-000000000001";

describe("custodia service", () => {
  it("registrar valida UUID y delega", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      registrarEventoCustodia(cliente as never, { trasladoId: "no-uuid", tipo: "transfer_started" })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("registrar rechaza odómetro negativo sin llamar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      registrarEventoCustodia(cliente as never, { trasladoId: TRASLADO, tipo: "transfer_started", odometro: -5 })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("registrar devuelve el id", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: "ev-1", error: null }) };
    const id = await registrarEventoCustodia(cliente as never, {
      trasladoId: TRASLADO,
      tipo: "vehicle_received",
      odometro: 100,
      fotoIds: [TRASLADO]
    });
    expect(id).toBe("ev-1");
    expect(cliente.rpc).toHaveBeenCalledWith("registrar_evento_custodia", expect.objectContaining({ p_odometro: 100 }));
  });

  it("verificar devuelve booleano", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
    await expect(verificarCadenaCustodia(cliente as never, TRASLADO)).resolves.toBe(true);
  });

  it("listar une fotos por evento", async () => {
    const eventos = [
      {
        id: "e1", traslado_id: TRASLADO, vehiculo_id: null, actor_id: null, actor_tipo: "sistema",
        tipo: "transfer_started", lat: null, lng: null, odometro: null, combustible: null,
        ocurrido_en: "2026-09-01", inspeccion_id: null, firma_metodo: null, pin_verificado: false,
        notas: null, metadata: {}, prev_hash: "GENESIS", hash_cadena: "abc", creado_en: "2026-09-01"
      }
    ];
    const joins = [{ evento_id: "e1", foto_id: "f1" }];
    const fotos = [{ id: "f1", tipo: "inicial", angulo: "frente", url: "u", lat: null, lng: null, capturada_en: "2026-09-01" }];
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: eventos, error: null }) }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: joins, error: null }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: fotos, error: null }) }) });
    const lista = await listarEventosCustodia({ from } as never, TRASLADO);
    expect(lista).toHaveLength(1);
    expect(lista[0].fotos).toHaveLength(1);
    expect(lista[0].fotos[0].angulo).toBe("frente");
  });

  it("reporte fusiona vehículo, eventos y verificación", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: true, error: null });
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { vehiculo_id: "v1" }, error: null }) }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { marca: "Nissan", modelo: "Versa", placas: "ABC", vin: null }, error: null }) }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) });
    const reporte = await obtenerReporteCustodia({ from, rpc } as never, TRASLADO);
    expect(reporte.cadena_integra).toBe(true);
    expect(reporte.vehiculo?.marca).toBe("Nissan");
    expect(reporte.total_eventos).toBe(0);
  });
});
