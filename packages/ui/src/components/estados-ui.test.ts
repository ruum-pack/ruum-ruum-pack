import { describe, it, expect } from "vitest";
import { ESTADOS_TRASLADO, type EstadoTraslado } from "@ruum/shared/states";
import { CATEGORIA_POR_ESTADO, type CategoriaEstado } from "./estado-visual";
import { ETAPAS_TRASLADO, ESTADOS_RAMIFICADOS } from "./etapas";

describe("PR-14 — Integración visual y operativa de estados en @ruum/ui", () => {
  const ESTADOS_ESPERADOS = 34;

  it("toda entrada tiene representación visual (CATEGORIA_POR_ESTADO)", () => {
    const categorias: readonly CategoriaEstado[] = ["inicial", "activo", "atencion", "completado", "fallido"];
    for (const estado of ESTADOS_TRASLADO) {
      const cat = CATEGORIA_POR_ESTADO[estado];
      expect(cat, `falta categoria visual para ${estado}`).toBeDefined();
      expect(categorias).toContain(cat);
    }
    expect(Object.keys(CATEGORIA_POR_ESTADO).sort()).toEqual([...ESTADOS_TRASLADO].sort());
  });

  it("toda entrada tiene tratamiento operativo: etapa o ramificado (ETAPAS + RAMIFICADOS)", () => {
    const todosEtapas = [...ETAPAS_TRASLADO.flatMap((e) => e.estados), ...ESTADOS_RAMIFICADOS];
    expect(todosEtapas).toHaveLength(ESTADOS_ESPERADOS);
    expect(new Set(todosEtapas).size).toBe(ESTADOS_ESPERADOS);
    for (const estado of ESTADOS_TRASLADO) {
      expect(todosEtapas, `estado ${estado} sin tratamiento operativo (ni etapa ni ramificado)`).toContain(estado);
    }
    const etapasSet = new Set(ETAPAS_TRASLADO.flatMap((e) => e.estados));
    const ramificadosSet = new Set(ESTADOS_RAMIFICADOS);
    for (const r of ramificadosSet) {
      expect(etapasSet.has(r), `estado ${r} no debe estar a la vez en etapa y ramificado`).toBe(false);
    }
    expect(Object.keys({ ...Object.fromEntries(ESTADOS_TRASLADO.map((s: EstadoTraslado) => [s, true])) }).sort()).toEqual([...ESTADOS_TRASLADO].sort());
  });
});
