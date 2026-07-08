import { describe, it, expect } from "vitest";
import { esElegibleParaModoPrueba, evaluarResultadoModoPrueba } from "./modo-prueba-supervisada";
import type { Conductor } from "../types/conductor";

function conductor(calificacion_promedio: number): Conductor {
  return {
    id: "c1",
    nombre: "Juan",
    estado: "activo",
    calificacion_promedio,
    traslados_completados: 10,
    suspensiones_activas: 0,
    no_presentaciones_6m: 0,
    cancelaciones_sin_justificacion_count: 0,
    documentos_vigentes: true,
    certificaciones: [],
    incidencias_graves_6m: 0,
    incidencias_graves_12m: 0,
    creado_en: new Date().toISOString()
  };
}

describe("esElegibleParaModoPrueba — PRD §4.13", () => {
  it("calificación < 4.0 es elegible para modo de prueba supervisada", () => {
    expect(esElegibleParaModoPrueba(conductor(3.7))).toBe(true);
  });

  it("calificación >= 4.0 no es elegible (no lo necesita)", () => {
    expect(esElegibleParaModoPrueba(conductor(4.0))).toBe(false);
  });
});

describe("evaluarResultadoModoPrueba — PRD §4.13", () => {
  it("recupera elegibilidad si la calificación recalculada alcanza 4.0+", () => {
    const r = evaluarResultadoModoPrueba(10, 10, 4.3);
    expect(r.recuperado).toBe(true);
    expect(r.nuevoEstado).toBe("activo");
  });

  it("sigue en prueba si aún no completa los traslados asignados", () => {
    const r = evaluarResultadoModoPrueba(10, 4, 3.5);
    expect(r.recuperado).toBe(false);
    expect(r.periodoCompletado).toBe(false);
    expect(r.nuevoEstado).toBe("modo_prueba_supervisada");
  });

  it("agota el periodo sin recuperar -> escala la suspensión", () => {
    const r = evaluarResultadoModoPrueba(10, 10, 3.5);
    expect(r.recuperado).toBe(false);
    expect(r.periodoCompletado).toBe(true);
    expect(r.nuevoEstado).toBe("suspendido_indefinido");
  });
});
