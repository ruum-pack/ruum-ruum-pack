import type { ResultadoCancelacion } from "../types/cancelacion";
import { MENSAJE_OBLIGATORIO_CANCELACION } from "../constants/mensajes-ux";

/**
 * PRD §4.7 — tabla de cargos por cancelación del usuario, calculada respecto
 * a la hora PROGRAMADA de inicio del traslado (no la hora de aceptación del
 * conductor):
 *   Antes de conductor asignado............................ 0%
 *   Asignado, faltando >= 6h para el inicio................ 20%
 *   Asignado, faltando entre 4h y <6h...................... 35%
 *   Asignado, faltando entre 2h y <4h...................... 50%
 *   Asignado, faltando < 2h................................ 75%
 *   Conductor ya llegó al punto de recolección............. 100%
 */
export function calcularCargoCancelacion(
  precioTotal: number,
  horasRestantesParaInicio: number,
  conductorAsignado: boolean,
  conductorYaLlego: boolean
): ResultadoCancelacion {
  let porcentaje: number;

  if (conductorYaLlego) {
    porcentaje = 100;
  } else if (!conductorAsignado) {
    porcentaje = 0;
  } else if (horasRestantesParaInicio >= 6) {
    porcentaje = 20;
  } else if (horasRestantesParaInicio >= 4) {
    porcentaje = 35;
  } else if (horasRestantesParaInicio >= 2) {
    porcentaje = 50;
  } else {
    porcentaje = 75;
  }

  const monto = Math.round(((precioTotal * porcentaje) / 100) * 100) / 100;

  return {
    porcentaje_cargo: porcentaje,
    monto_cargo: monto,
    mensaje: MENSAJE_OBLIGATORIO_CANCELACION(porcentaje)
  };
}
