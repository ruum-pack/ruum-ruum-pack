import { describe, expect, it, vi } from "vitest";
import {
  evaluarSlaTraslados,
  listarPoliticasSla,
  obtenerColaTorreSla,
  obtenerReporteSla
} from "./motor-alertas";

const COLA = [
  {
    traslado_id: "00000000-0000-0000-0000-000000000001",
    policy_codigo: "asignacion",
    incidencia_id: null,
    estado: "breach",
    porcentaje: 250,
    deadline: "2026-09-12T10:00:00.000Z",
    horas_transcurridas: 5,
    horas_limite: 2,
    prioridad_torre: 125,
    severidad: "alta",
    estado_traslado: "pendiente_de_conductor",
    estado_operativo: "planned",
    operacion_id: null,
    empresa_id: null,
    ultima_evaluacion_en: "2026-09-12T09:00:00.000Z"
  }
];

const REPORTE = {
  desde: "2026-09-11T00:00:00.000Z",
  hasta: "2026-09-12T00:00:00.000Z",
  empresa_id: null,
  operacion_id: null,
  por_politica: [
    { policy_codigo: "asignacion", warnings: 1, breaches: 2, recuperados: 1, traslados_afectados: 3 }
  ],
  totales: { warnings: 1, breaches: 2, recuperados: 1, traslados_afectados: 3, eventos: 4 },
  generado_en: "2026-09-12T09:00:00.000Z"
};

describe("sla motor de alertas (Fase 13)", () => {
  it("lista políticas activas ordenadas", async () => {
    const filas = [
      { codigo: "asignacion", nombre: "Asignación", descripcion: "", horas_limite: 2, warning_pct: 75, severidad: "alta", prioridad_base: 75, activo: true }
    ];
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: filas, error: null })
          })
        })
      })
    };
    await expect(listarPoliticasSla(cliente as never)).resolves.toEqual(filas);
  });

  it("valida límite antes de evaluar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(evaluarSlaTraslados(cliente as never, 0)).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("mapea el resumen de evaluación", async () => {
    const resumen = { evaluados: 3, warnings: 1, breaches: 2, recuperados: 0, evaluado_en: "2026-09-12T09:00:00.000Z" };
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: resumen, error: null }) };
    await expect(evaluarSlaTraslados(cliente as never, 500)).resolves.toEqual(resumen);
    expect(cliente.rpc).toHaveBeenCalledWith(
      "sla_evaluar_traslados",
      expect.objectContaining({ p_limite: 500 })
    );
  });

  it("mapea la cola de Torre", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: COLA, error: null }) };
    await expect(obtenerColaTorreSla(cliente as never, {})).resolves.toEqual(COLA);
    expect(cliente.rpc).toHaveBeenCalledWith(
      "admin_sla_cola_torre",
      expect.objectContaining({ p_limite: 100 })
    );
  });

  it("rechaza rango inválido en reporte", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      obtenerReporteSla(cliente as never, { desde: "no-fecha", hasta: "2026-09-12T00:00:00.000Z" })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("mapea el reporte histórico", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: REPORTE, error: null }) };
    await expect(
      obtenerReporteSla(cliente as never, { desde: REPORTE.desde, hasta: REPORTE.hasta })
    ).resolves.toEqual(REPORTE);
  });

  it("propaga errores de RPC", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("PERMISO_INSUFICIENTE") }) };
    await expect(evaluarSlaTraslados(cliente as never)).rejects.toThrow(/PERMISO_INSUFICIENTE/);
    await expect(obtenerColaTorreSla(cliente as never)).rejects.toThrow(/PERMISO_INSUFICIENTE/);
  });
});
