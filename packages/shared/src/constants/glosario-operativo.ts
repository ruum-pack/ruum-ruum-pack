export const GLOSARIO_OPERATIVO = {
  solicitado: "Disponible",
  aceptado: "Próximo",
  en_progreso: "En curso",
  pendiente_validacion: "En validación",
  payout_pending: "Depósito programado",
  disputa: "Revisión de un traslado",
  incidencia: "Reportar un problema",
  evidencia: "Registro del vehículo"
} as const;

export type ConceptoGlosarioOperativo = keyof typeof GLOSARIO_OPERATIVO;

export function textoGlosario(concepto: ConceptoGlosarioOperativo) {
  return GLOSARIO_OPERATIVO[concepto];
}
