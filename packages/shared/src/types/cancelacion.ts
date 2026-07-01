// PRD §4.7 — resultado de evaluar un cargo por cancelación del usuario
export interface ResultadoCancelacion {
  porcentaje_cargo: number;
  monto_cargo: number;
  // Mensaje obligatorio antes de confirmar la cancelación — PRD §4.7
  mensaje: string;
}
