import type {
  CandidatoAsignacion,
  CategoriaPuntualidad,
  ResumenPuntualidad
} from "../types/asignacion";

const ORDEN_PUNTUALIDAD: Record<CategoriaPuntualidad, number> = {
  a: 3,
  b: 2,
  sin_datos: 2,
  c: 1
};

export function resumirPuntualidad(
  puntuales: number,
  total: number,
  muestraMinima = 5
): ResumenPuntualidad {
  if (!Number.isInteger(puntuales) || !Number.isInteger(total) || puntuales < 0 || total < 0 || puntuales > total) {
    throw new Error("La muestra de puntualidad es inválida.");
  }

  if (total < muestraMinima) {
    return { categoria: "sin_datos", porcentaje: total === 0 ? null : puntuales / total, muestra: total };
  }

  const porcentaje = puntuales / total;
  const categoria: CategoriaPuntualidad = porcentaje >= 0.95 ? "a" : porcentaje >= 0.85 ? "b" : "c";
  return { categoria, porcentaje, muestra: total };
}

/**
 * ADR-003: orden lexicográfico y estable. La puntualidad no se compensa con
 * otras señales; dentro de la misma categoría se prioriza la equidad.
 */
export function compararCandidatosAsignacion(a: CandidatoAsignacion, b: CandidatoAsignacion): number {
  const porPuntualidad = ORDEN_PUNTUALIDAD[b.puntualidad.categoria] - ORDEN_PUNTUALIDAD[a.puntualidad.categoria];
  if (porPuntualidad !== 0) return porPuntualidad;

  const porAsignaciones = a.asignaciones_7d - b.asignaciones_7d;
  if (porAsignaciones !== 0) return porAsignaciones;

  if (a.ultima_asignacion_en === null && b.ultima_asignacion_en !== null) return -1;
  if (a.ultima_asignacion_en !== null && b.ultima_asignacion_en === null) return 1;
  if (a.ultima_asignacion_en && b.ultima_asignacion_en) {
    const porAntiguedad = new Date(a.ultima_asignacion_en).getTime() - new Date(b.ultima_asignacion_en).getTime();
    if (porAntiguedad !== 0) return porAntiguedad;
  }

  return a.desempate.localeCompare(b.desempate);
}

export function ordenarCandidatosAsignacion(candidatos: CandidatoAsignacion[]): CandidatoAsignacion[] {
  return [...candidatos].sort(compararCandidatosAsignacion);
}

