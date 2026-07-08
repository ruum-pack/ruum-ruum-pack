import type { ResultadoSLA } from "../types/sla";
import { evaluarSLA } from "../utils/evaluar-sla";

// PRD §4.1 — SLAs de verificación, en horas hábiles
export const HORAS_HABILES_VERIFICACION_CUENTA_NUEVA = 2;
export const HORAS_HABILES_REVISION_DOCUMENTOS_USUARIO = 4;
export const HORAS_HABILES_VERIFICACION_CONDUCTOR_PRIMERA_VEZ = 24;
export const HORAS_HABILES_REVISION_DOCUMENTOS_CONDUCTOR = 24;

export function slaVerificacionCuentaNueva(horasHabilesTranscurridas: number): ResultadoSLA {
  return evaluarSLA(horasHabilesTranscurridas, HORAS_HABILES_VERIFICACION_CUENTA_NUEVA);
}

export function slaRevisionDocumentosUsuario(horasHabilesTranscurridas: number): ResultadoSLA {
  return evaluarSLA(horasHabilesTranscurridas, HORAS_HABILES_REVISION_DOCUMENTOS_USUARIO);
}

export function slaVerificacionConductorPrimeraVez(horasHabilesTranscurridas: number): ResultadoSLA {
  return evaluarSLA(horasHabilesTranscurridas, HORAS_HABILES_VERIFICACION_CONDUCTOR_PRIMERA_VEZ);
}

export function slaRevisionDocumentosConductor(horasHabilesTranscurridas: number): ResultadoSLA {
  return evaluarSLA(horasHabilesTranscurridas, HORAS_HABILES_REVISION_DOCUMENTOS_CONDUCTOR);
}

// PRD §4.13 — calificación debe completarse en 72 horas; después el sistema
// registra "sin calificación" (no es estrictamente un SLA de Admin, pero
// comparte la misma forma de evaluación de plazo).
export const HORAS_PLAZO_CALIFICACION = 72;

export function dentroDePlazoCalificacion(horasTranscurridasDesdeCierre: number): boolean {
  return horasTranscurridasDesdeCierre <= HORAS_PLAZO_CALIFICACION;
}
