// PRD §4.9 — seguro de traslado y manejo de siniestros
// Cobertura: entre "Vehículo recibido" y "Entrega confirmada" (custodia operativa).
// No cubre daños documentados como preexistentes en evidencia inicial.
export type EstadoReclamoSeguro = "abierto" | "en_revision" | "resuelto";

// Decisión de producto (sesión de arquitectura, 2026-06-27) — el deducible
// nunca se carga al usuario, sin distinción de severidad del daño (mayor o
// menor). Este tipo solo captura QUIÉN absorbe el deducible, no CUÁNTO es:
// los montos siguen pendientes de validación con la aseguradora (ver nota
// abajo, sin cambios respecto a la versión original de este archivo).
export type ResponsablePagoDeducible = "aplicacion" | "conductor";

export interface ReclamoSeguro {
  id: string;
  traslado_id: string;
  estado: EstadoReclamoSeguro;
  // PRD §4.9 — el usuario solo ve el estatus, nunca montos de póliza ni datos
  // internos de la aseguradora dentro de la app.
  abierto_en: string;
  resuelto_en?: string;
  // Obligatorio antes de poder marcar el reclamo como resuelto (ver
  // constraint reclamos_seguro_responsable_si_resuelto en 0017).
  responsable_pago?: ResponsablePagoDeducible;
  // Nota PRD §4.9: "las reglas de cobertura, deducible y tiempos de resolución
  // deben validarse con la aseguradora y área legal antes de construirse como
  // lógica de negocio definitiva". Por eso NO se modelan montos de deducible
  // ni porcentajes de cobertura aquí — son datos pendientes de Producto/Legal,
  // no una omisión de implementación.
  notas_admin?: string;
}

// PRD §4.9 — MVP del flujo de reclamo (8 pasos, ver rules/cobertura-seguro.ts)
export type PasoReclamoSeguro =
  | "dano_identificado"
  | "incidencia_abierta"
  | "usuario_notificado"
  | "usuario_confirma_o_disputa"
  | "reclamo_evaluado"
  | "reclamo_abierto"
  | "reclamo_en_seguimiento"
  | "reclamo_resuelto";
