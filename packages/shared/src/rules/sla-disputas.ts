import type { ResultadoSLA } from "../types/sla";
import { evaluarSLA } from "../utils/evaluar-sla";

// PRD §4.14 — plazos del mecanismo de resolución de disputas
export const HORAS_PLAZO_APERTURA_DISPUTA = 72; // post-cierre del traslado
export const HORAS_PLAZO_REVISION_ADMIN = 48; // Admin revisa evidencia/bitácora/comunicación
export const DIAS_HABILES_SLA_RESOLUCION_ESTANDAR = 5;
export const DIAS_HABILES_SLA_RESOLUCION_ESCALADA = 10;
export const HORAS_PLAZO_ESCALAMIENTO = 48; // tras resolución, para escalar a Admin senior

export function puedeAbrirseDisputa(horasTranscurridasDesdeCierre: number): boolean {
  return horasTranscurridasDesdeCierre <= HORAS_PLAZO_APERTURA_DISPUTA;
}

export function slaRevisionAdmin(horasTranscurridasDesdeApertura: number): ResultadoSLA {
  return evaluarSLA(horasTranscurridasDesdeApertura, HORAS_PLAZO_REVISION_ADMIN);
}

export function slaResolucionDisputa(diasHabilesTranscurridos: number, escalada: boolean): ResultadoSLA {
  const limite = escalada ? DIAS_HABILES_SLA_RESOLUCION_ESCALADA : DIAS_HABILES_SLA_RESOLUCION_ESTANDAR;
  return evaluarSLA(diasHabilesTranscurridos, limite);
}

export function puedeEscalarse(horasTranscurridasDesdeResolucion: number): boolean {
  return horasTranscurridasDesdeResolucion <= HORAS_PLAZO_ESCALAMIENTO;
}
