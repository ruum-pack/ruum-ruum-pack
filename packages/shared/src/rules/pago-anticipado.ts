import type { Usuario } from "../types/usuario";
import type { MomentoPago } from "../types/pago";

// PRD §4.6 — "Historial positivo se define como al menos 2 traslados
// completados sin incidencias de pago; Admin puede ajustar este umbral."
export const UMBRAL_HISTORIAL_POSITIVO = 2;

export interface ResultadoMomentoPago {
  momento: MomentoPago;
  razon: string;
}

/**
 * PRD §4.6 — determina si un usuario opera bajo pago anticipado u "al cierre":
 * - Cuenta empresa con autorización corporativa vigente: al cierre por defecto
 *   (sujeto a validación de Admin).
 * - Usuario personal con historial positivo (>= umbral) Y método de pago
 *   registrado: puede operar al cierre.
 * - Cualquier otro caso: pago anticipado obligatorio.
 * Nota: independientemente del resultado, ningún traslado puede iniciar
 * evidencia inicial sin un método de pago válido y vigente — ver
 * rules/evidencia-requerida.ts y constants/metodos-pago.ts.
 */
export function determinarMomentoPago(
  usuario: Usuario,
  umbralHistorialPositivo: number = UMBRAL_HISTORIAL_POSITIVO
): ResultadoMomentoPago {
  if (usuario.tipo_cuenta === "empresa" && usuario.rol === "titular_empresa") {
    return {
      momento: "al_cierre",
      razon: "Cuenta empresa con autorización corporativa vigente (sujeto a validación de Admin)."
    };
  }

  const tieneHistorialPositivo =
    usuario.traslados_completados_sin_incidencia >= umbralHistorialPositivo &&
    usuario.metodo_pago_registrado;

  if (tieneHistorialPositivo) {
    return {
      momento: "al_cierre",
      razon: `Historial positivo (≥${umbralHistorialPositivo} traslados sin incidencias de pago) y método de pago registrado.`
    };
  }

  return {
    momento: "anticipado",
    razon: "Sin historial suficiente o sin método de pago registrado."
  };
}
