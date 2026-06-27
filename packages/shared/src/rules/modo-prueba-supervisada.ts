import type { Conductor, EstadoConductor } from "../types/conductor";
import { nivelPorCalificacion } from "./calificacion-nivel";

// PRD §4.13 — "Mecanismo de recuperación: un conductor con calificación menor
// a 4.0 puede operar en modo de prueba supervisada, en el cual Admin le
// asigna un número limitado de traslados monitoreados para permitir que la
// calificación se recalcule; si no recupera el mínimo dentro de ese periodo,
// la suspensión escala según la política de Admin."
// El PRD NO fija el número de traslados asignados ni el detalle de la
// escalación — ambos quedan a discreción de Admin caso por caso.
export const CALIFICACION_MINIMA_RECUPERACION = 4.0;

export function esElegibleParaModoPrueba(conductor: Conductor): boolean {
  return conductor.calificacion_promedio < CALIFICACION_MINIMA_RECUPERACION;
}

export interface ResultadoModoPrueba {
  recuperado: boolean;
  periodoCompletado: boolean;
  nuevoEstado: EstadoConductor;
  mensaje: string;
}

/**
 * Evalúa el resultado del modo de prueba supervisada una vez que el
 * conductor completó (o agotó) los traslados monitoreados asignados por Admin.
 *
 * @param trasladosAsignados   Número de traslados que Admin asignó para la prueba (decisión de Admin, no del PRD).
 * @param trasladosCompletados Traslados monitoreados completados hasta el momento.
 * @param calificacionRecalculada Calificación promedio recalculada solo sobre los traslados del periodo de prueba.
 */
export function evaluarResultadoModoPrueba(
  trasladosAsignados: number,
  trasladosCompletados: number,
  calificacionRecalculada: number
): ResultadoModoPrueba {
  const periodoCompletado = trasladosCompletados >= trasladosAsignados;
  const recuperado = nivelPorCalificacion(calificacionRecalculada) !== null;

  if (recuperado) {
    return {
      recuperado: true,
      periodoCompletado,
      nuevoEstado: "activo",
      mensaje: "Calificación recuperada por encima del mínimo (4.0). Conductor reactivado como activo."
    };
  }

  if (!periodoCompletado) {
    return {
      recuperado: false,
      periodoCompletado: false,
      nuevoEstado: "modo_prueba_supervisada",
      mensaje: `Periodo de prueba en curso: ${trasladosCompletados}/${trasladosAsignados} traslados monitoreados completados.`
    };
  }

  // Periodo agotado sin recuperar el mínimo: el PRD indica que "la
  // suspensión escala según la política de Admin" sin fijar el siguiente
  // estado. Se devuelve "suspendido_indefinido" como punto de partida
  // razonable para que Admin decida el escalamiento final.
  return {
    recuperado: false,
    periodoCompletado: true,
    nuevoEstado: "suspendido_indefinido",
    mensaje:
      "Periodo de prueba agotado sin recuperar la calificación mínima. Escalamiento de suspensión pendiente de decisión de Admin."
  };
}
