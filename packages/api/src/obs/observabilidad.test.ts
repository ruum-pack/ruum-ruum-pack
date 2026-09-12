import { describe, expect, it, vi } from "vitest";
import {
  nuevoCorrelationId,
  obtenerDashboardObs,
  obtenerMetricasNegocio,
  obtenerTrackingFallos,
  purgarObservabilidad,
  registrarLatenciaRpc,
  registrarLogObs
} from "./observabilidad";

const TRASLADO = "00000000-0000-0000-0000-000000000001";

describe("obs observabilidad (Fase 14)", () => {
  it("genera correlation con formato UUID", () => {
    expect(nuevoCorrelationId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("valida nivel y servicio antes de loguear", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      registrarLogObs(cliente as never, { nivel: "debug" as never, servicio: "torre", nombre: "x" })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("registra log y devuelve id", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: 7, error: null }) };
    await expect(
      registrarLogObs(cliente as never, { nivel: "error", servicio: "torre", nombre: "fallo" })
    ).resolves.toBe(7);
    expect(cliente.rpc).toHaveBeenCalledWith(
      "obs_registrar_log",
      expect.objectContaining({ p_nivel: "error" })
    );
  });

  it("valida duración de latencia", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      registrarLatenciaRpc(cliente as never, { funcion: "f", duracionMs: -1 })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("mapea fallos de tracking", async () => {
    const filas = [
      {
        traslado_id: TRASLADO,
        estado_traslado: "traslado_en_curso",
        estado_operativo: "in_transit",
        conductor_id: null,
        operacion_id: null,
        empresa_id: null,
        ultimo_envio_en: null,
        minutos_sin_senal: null,
        salud: "OFFLINE",
        sin_sesion_activa: true,
        desviacion_sospechosa: false
      }
    ];
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: filas, error: null }) };
    await expect(obtenerTrackingFallos(cliente as never)).resolves.toEqual(filas);
  });

  it("rechaza rango inválido en dashboard", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      obtenerDashboardObs(cliente as never, { desde: "x", hasta: "2026-09-12T00:00:00.000Z" })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("mapea métricas de negocio", async () => {
    const metricas = {
      desde: "2026-09-11T00:00:00.000Z",
      hasta: "2026-09-12T00:00:00.000Z",
      empresa_id: null,
      operacion_id: null,
      time_to_assign_horas: 2,
      pickup_on_time_rate: 1,
      delivery_on_time_rate: null,
      average_transfer_duration_horas: null,
      tracking_uptime: 0,
      incident_rate: 0.25,
      claim_rate: null,
      driver_acceptance_rate: 0.5,
      evidence_completion_rate: 0.5,
      operation_margin: {
        facturado: 1000,
        costo_conductor: 600,
        gastos_directos: 100,
        comisiones: 36,
        margen_contribucion: 264
      },
      generado_en: "2026-09-12T09:00:00.000Z"
    };
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: metricas, error: null }) };
    await expect(
      obtenerMetricasNegocio(cliente as never, { desde: metricas.desde, hasta: metricas.hasta })
    ).resolves.toEqual(metricas);
  });

  it("restringe purga a tablas con política", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      purgarObservabilidad(cliente as never, { tabla: "traslados" as never })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("propaga errores de RPC", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("PERMISO_INSUFICIENTE") }) };
    await expect(
      registrarLatenciaRpc(cliente as never, { funcion: "f", duracionMs: 5 })
    ).rejects.toThrow(/PERMISO_INSUFICIENTE/);
  });
});
