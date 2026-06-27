import type { NivelCONCER } from "../types/conductor";
import type { CalificacionTraslado } from "../types/conductor";

/**
 * PRD §4.13 — rangos de calificación que determinan elegibilidad por calificación:
 * < 4.0 pierde elegibilidad; 4.0–4.49 Básica; 4.5–4.79 Ejecutiva;
 * 4.8–4.89 Luxury; ≥4.9 Colección (sujeto a cumplir además la matriz §4.3).
 */
export function nivelPorCalificacion(calificacionPromedio: number): NivelCONCER | null {
  if (calificacionPromedio >= 4.9) return "coleccion";
  if (calificacionPromedio >= 4.8) return "luxury";
  if (calificacionPromedio >= 4.5) return "ejecutivo";
  if (calificacionPromedio >= 4.0) return "basico";
  return null;
}

/**
 * PRD §4.13 — "Calificación promedio del conductor se calcula sobre los
 * traslados completados en los últimos 6 meses, considerando como máximo
 * los 100 más recientes dentro de esa ventana."
 */
export function calcularCalificacionPromedio(
  calificaciones: CalificacionTraslado[],
  ahora: Date = new Date()
): number {
  const seisMesesAtras = new Date(ahora);
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  const dentroDeVentana = calificaciones
    .filter((c) => new Date(c.calificado_en) >= seisMesesAtras && new Date(c.calificado_en) <= ahora)
    .sort((a, b) => new Date(b.calificado_en).getTime() - new Date(a.calificado_en).getTime())
    .slice(0, 100);

  if (dentroDeVentana.length === 0) return 0;

  const suma = dentroDeVentana.reduce((acc, c) => acc + c.estrellas, 0);
  return Math.round((suma / dentroDeVentana.length) * 100) / 100;
}
