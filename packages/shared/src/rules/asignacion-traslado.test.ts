import { describe, expect, it } from "vitest";
import type { CandidatoAsignacion } from "../types/asignacion";
import { ordenarCandidatosAsignacion, resumirPuntualidad } from "./asignacion-traslado";

function candidato(overrides: Partial<CandidatoAsignacion> = {}): CandidatoAsignacion {
  return {
    conductor_id: "c1",
    puntualidad: { categoria: "b", porcentaje: 0.9, muestra: 10 },
    asignaciones_7d: 2,
    ultima_asignacion_en: "2026-09-01T12:00:00.000Z",
    desempate: "b",
    ...overrides
  };
}

describe("asignación automática ADR-003", () => {
  it("mantiene neutral al conductor sin muestra suficiente", () => {
    expect(resumirPuntualidad(3, 3)).toEqual({ categoria: "sin_datos", porcentaje: 1, muestra: 3 });
  });

  it("clasifica A desde 95%, B desde 85% y C por debajo", () => {
    expect(resumirPuntualidad(19, 20).categoria).toBe("a");
    expect(resumirPuntualidad(17, 20).categoria).toBe("b");
    expect(resumirPuntualidad(16, 20).categoria).toBe("c");
  });

  it("prioriza puntualidad antes que volumen de asignaciones", () => {
    const resultado = ordenarCandidatosAsignacion([
      candidato({ conductor_id: "b", puntualidad: { categoria: "b", porcentaje: 0.9, muestra: 10 }, asignaciones_7d: 0 }),
      candidato({ conductor_id: "a", puntualidad: { categoria: "a", porcentaje: 1, muestra: 10 }, asignaciones_7d: 8 })
    ]);
    expect(resultado.map((fila) => fila.conductor_id)).toEqual(["a", "b"]);
  });

  it("aplica equidad y antigüedad dentro de la misma categoría", () => {
    const resultado = ordenarCandidatosAsignacion([
      candidato({ conductor_id: "reciente", asignaciones_7d: 2, ultima_asignacion_en: "2026-09-02T12:00:00.000Z" }),
      candidato({ conductor_id: "sin-asignaciones", asignaciones_7d: 0, ultima_asignacion_en: null }),
      candidato({ conductor_id: "antiguo", asignaciones_7d: 2, ultima_asignacion_en: "2026-08-20T12:00:00.000Z" })
    ]);
    expect(resultado.map((fila) => fila.conductor_id)).toEqual(["sin-asignaciones", "antiguo", "reciente"]);
  });

  it("usa un desempate estable cuando todo lo demás coincide", () => {
    const resultado = ordenarCandidatosAsignacion([
      candidato({ conductor_id: "c2", desempate: "z" }),
      candidato({ conductor_id: "c1", desempate: "a" })
    ]);
    expect(resultado.map((fila) => fila.conductor_id)).toEqual(["c1", "c2"]);
  });
});

