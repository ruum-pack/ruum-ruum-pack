import { describe, expect, it } from "vitest";
import {
  DOMINIO_POR_ESTADO,
  LEGACY_A_OPERATIVO,
  LegacyTransferStateMapper,
  dominioDeEstado,
  esOperativoTerminal,
  estaViajando,
  mapearEstadoOperativo
} from "./operativo-traslado";
import { ESTADOS_TRASLADO } from "./estados-traslado";

describe("LegacyTransferStateMapper (Fase 3)", () => {
  it("cubre los 34 estados legacy sin huecos", () => {
    expect(ESTADOS_TRASLADO).toHaveLength(34);
    for (const estado of ESTADOS_TRASLADO) {
      expect(LEGACY_A_OPERATIVO[estado]).toBeDefined();
      expect(DOMINIO_POR_ESTADO[estado]).toBeDefined();
    }
    expect(Object.keys(LEGACY_A_OPERATIVO)).toHaveLength(34);
  });

  it("traduce los dominios del plan", () => {
    expect(mapearEstadoOperativo("solicitud_creada")).toBe("requested");
    expect(mapearEstadoOperativo("conductor_asignado")).toBe("assigned");
    expect(mapearEstadoOperativo("traslado_en_curso")).toBe("in_transit");
    expect(dominioDeEstado("conductor_asignado")).toBe("Assignment");
    expect(dominioDeEstado("pago_pendiente")).toBe("Billing");
    expect(dominioDeEstado("reclamo_abierto")).toBe("Claim");
    expect(dominioDeEstado("disputa_abierta")).toBe("Dispute");
    expect(dominioDeEstado("documentacion_pendiente")).toBe("Documentation");
    expect(dominioDeEstado("solicitud_creada")).toBe("Transfer");
  });

  it("criterio de salida: viajando no depende de pago/reclamo/disputa", () => {
    expect(estaViajando("traslado_en_curso")).toBe(true);
    expect(estaViajando("incidencia_reportada")).toBe(true);
    expect(estaViajando("in_transit")).toBe(true);
    for (const e of ["pago_pendiente", "pago_completado", "reclamo_abierto", "reclamo_resuelto", "disputa_abierta", "disputa_resuelta"] as const) {
      expect(mapearEstadoOperativo(e)).toBe("closed");
      expect(estaViajando(e)).toBe(false);
    }
    expect(estaViajando("entrega_confirmada")).toBe(false);
    expect(estaViajando("conductor_asignado")).toBe(false);
  });

  it("terminales operativos", () => {
    expect(esOperativoTerminal("closed")).toBe(true);
    expect(esOperativoTerminal("cancelled")).toBe(true);
    expect(esOperativoTerminal("failed")).toBe(true);
    expect(esOperativoTerminal("in_transit")).toBe(false);
    expect(esOperativoTerminal("delivered")).toBe(false);
  });

  it("expone punto único de compatibilidad", () => {
    expect(LegacyTransferStateMapper.toOperativo("pago_pendiente")).toBe("closed");
    expect(LegacyTransferStateMapper.dominio("disputa_abierta")).toBe("Dispute");
    expect(LegacyTransferStateMapper.estaViajando("traslado_en_curso")).toBe(true);
  });
});
