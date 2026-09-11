import { describe, expect, it } from "vitest";
import {
  esAsignacionVigente,
  esTransicionAsignacionValida,
  ESTADOS_ASIGNACION
} from "./estados-asignacion";

describe("estados de asignación (Fase 4)", () => {
  it("expone los 7 estados del plan", () => {
    expect(ESTADOS_ASIGNACION).toEqual([
      "pendiente",
      "ofrecida",
      "aceptada",
      "rechazada",
      "cancelada",
      "activa",
      "completada"
    ]);
  });

  it("flujo oferta -> aceptación -> activación -> cierre", () => {
    expect(esTransicionAsignacionValida("ofrecida", "aceptada")).toBe(true);
    expect(esTransicionAsignacionValida("aceptada", "activa")).toBe(true);
    expect(esTransicionAsignacionValida("activa", "completada")).toBe(true);
  });

  it("rechazo y cancelación no salen de terminal", () => {
    expect(esTransicionAsignacionValida("ofrecida", "rechazada")).toBe(true);
    expect(esTransicionAsignacionValida("aceptada", "cancelada")).toBe(true);
    expect(esTransicionAsignacionValida("rechazada", "aceptada")).toBe(false);
    expect(esTransicionAsignacionValida("cancelada", "activa")).toBe(false);
    expect(esTransicionAsignacionValida("completada", "activa")).toBe(false);
  });

  it("vigencia coincide con el índice único parcial", () => {
    expect(esAsignacionVigente("ofrecida")).toBe(true);
    expect(esAsignacionVigente("aceptada")).toBe(true);
    expect(esAsignacionVigente("rechazada")).toBe(false);
    expect(esAsignacionVigente("completada")).toBe(false);
  });
});
