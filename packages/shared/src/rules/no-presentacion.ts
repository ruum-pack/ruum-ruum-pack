import type { EstadoConductor } from "../types/conductor";

export interface ResultadoNoPresentacion {
  nuevoEstado: EstadoConductor;
  diasSuspension?: number;
  mensaje: string;
}

/**
 * PRD §4.8 — consecuencias por no presentación del conductor, contadas
 * dentro de una ventana móvil de 6 meses:
 *   1ra ocurrencia.... Suspensión 7 días
 *   2da ocurrencia.... Suspensión 14 días
 *   3ra ocurrencia.... Suspensión 30 días
 *   4ta ocurrencia.... Suspensión indefinida (reactivable por acuerdo compromiso)
 *   5ta ocurrencia.... Bloqueo permanente
 */
export function consecuenciaNoPresentacion(ocurrenciasEn6Meses: number): ResultadoNoPresentacion {
  switch (ocurrenciasEn6Meses) {
    case 1:
      return {
        nuevoEstado: "suspendido_7d",
        diasSuspension: 7,
        mensaje: "Suspensión de 7 días por primera no presentación en los últimos 6 meses."
      };
    case 2:
      return {
        nuevoEstado: "suspendido_14d",
        diasSuspension: 14,
        mensaje: "Suspensión de 14 días por segunda no presentación en los últimos 6 meses."
      };
    case 3:
      return {
        nuevoEstado: "suspendido_30d",
        diasSuspension: 30,
        mensaje: "Suspensión de 30 días por tercera no presentación en los últimos 6 meses."
      };
    case 4:
      return {
        nuevoEstado: "suspendido_indefinido",
        mensaje:
          "Suspensión indefinida por cuarta no presentación. Reactivación posible mediante acuerdo compromiso."
      };
    default:
      return {
        nuevoEstado: "bloqueado_permanente",
        mensaje: "Bloqueo permanente por quinta no presentación (o más) en los últimos 6 meses."
      };
  }
}
