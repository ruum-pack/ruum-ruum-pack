import type { EstadoConductor } from "../types/conductor";

export interface ResultadoCancelacionConductor {
  nuevoEstado: EstadoConductor;
  diasSuspension?: number;
  mensaje: string;
}

/**
 * Decisión de producto (sesión de arquitectura, 2026-06-27) — cierra el
 * vacío del PRD §4.8, que solo definía consecuencias por NO PRESENTACIÓN
 * (no llegar). La cancelación activa de un traslado ya aceptado, sin
 * justificación, es una infracción distinta:
 *   1ra ocurrencia.......... Suspensión 30 días
 *   2da ocurrencia (o más)... Bloqueo permanente
 * Una cancelación con justificación válida, registrada por Admin, no debe
 * llegar a llamar esta función (no incrementa el contador
 * cancelaciones_sin_justificacion_count en conductores).
 */
export function consecuenciaCancelacionConductor(
  cancelacionesSinJustificacion: number
): ResultadoCancelacionConductor {
  if (cancelacionesSinJustificacion <= 1) {
    return {
      nuevoEstado: "suspendido_30d",
      diasSuspension: 30,
      mensaje: "Suspensión de 30 días por cancelar un traslado ya aceptado sin justificación."
    };
  }
  return {
    nuevoEstado: "bloqueado_permanente",
    mensaje: "Bloqueo permanente por reincidencia en cancelación de traslados aceptados sin justificación."
  };
}
