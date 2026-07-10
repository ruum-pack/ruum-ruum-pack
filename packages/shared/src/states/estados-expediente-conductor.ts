export const ESTADOS_EXPEDIENTE_CONDUCTOR = [
  "borrador",
  "correo_pendiente",
  "datos_incompletos",
  "documentos_pendientes",
  "listo_para_enviar",
  "en_revision",
  "requiere_correccion",
  "aprobado",
  "rechazado",
  "suspendido"
] as const;

export type EstadoExpedienteConductor = (typeof ESTADOS_EXPEDIENTE_CONDUCTOR)[number];

export const ESTADOS_DOCUMENTO_CONDUCTOR = [
  "en_revision",
  "aprobado",
  "rechazado",
  "reemplazado",
  "vencido"
] as const;

export type EstadoDocumentoConductor = (typeof ESTADOS_DOCUMENTO_CONDUCTOR)[number];

/**
 * Fuente única de transiciones del expediente en TypeScript. La migración 55
 * refleja exactamente estas aristas y las hace cumplir también en Postgres.
 */
export const TRANSICIONES_EXPEDIENTE_CONDUCTOR = {
  borrador: ["correo_pendiente"],
  correo_pendiente: ["datos_incompletos", "documentos_pendientes"],
  datos_incompletos: ["documentos_pendientes"],
  documentos_pendientes: ["listo_para_enviar"],
  listo_para_enviar: ["en_revision"],
  en_revision: ["requiere_correccion", "aprobado", "rechazado"],
  requiere_correccion: ["datos_incompletos", "documentos_pendientes", "listo_para_enviar"],
  aprobado: ["suspendido"],
  rechazado: [],
  suspendido: ["aprobado", "rechazado"]
} as const satisfies Record<EstadoExpedienteConductor, readonly EstadoExpedienteConductor[]>;

export const TRANSICIONES_DOCUMENTO_CONDUCTOR = {
  en_revision: ["aprobado", "rechazado", "reemplazado"],
  aprobado: ["vencido", "reemplazado"],
  rechazado: ["reemplazado"],
  reemplazado: [],
  vencido: ["reemplazado"]
} as const satisfies Record<EstadoDocumentoConductor, readonly EstadoDocumentoConductor[]>;

export function puedeTransicionarExpedienteConductor(
  origen: EstadoExpedienteConductor,
  destino: EstadoExpedienteConductor
) {
  return (TRANSICIONES_EXPEDIENTE_CONDUCTOR[origen] as readonly EstadoExpedienteConductor[]).includes(destino);
}

export function puedeTransicionarDocumentoConductor(
  origen: EstadoDocumentoConductor,
  destino: EstadoDocumentoConductor
) {
  return (TRANSICIONES_DOCUMENTO_CONDUCTOR[origen] as readonly EstadoDocumentoConductor[]).includes(destino);
}
