import type { ResultadoSLA } from "../types/sla";

// PRD §4.1 — "Admin recibe alertas cuando un usuario o conductor supera el
// 80% del SLA sin resolución." Umbral reutilizado por cualquier regla de SLA.
export const PORCENTAJE_ALERTA_SLA = 80;

export function evaluarSLA(transcurrido: number, limite: number): ResultadoSLA {
  const porcentaje = limite === 0 ? 100 : Math.round((transcurrido / limite) * 100);
  return {
    dentro_de_sla: transcurrido <= limite,
    horas_transcurridas: transcurrido,
    horas_limite: limite,
    porcentaje_consumido: porcentaje,
    requiere_alerta: porcentaje >= PORCENTAJE_ALERTA_SLA && transcurrido <= limite
  };
}
