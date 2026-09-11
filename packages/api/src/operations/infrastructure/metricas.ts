/**
 * FASE 5 — Dominio operations (Torre de Control): parseo defensivo de
 * payloads de métricas. Movido sin cambios desde services/admin.ts.
 */
export function objetoMetrica(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

export function numeroMetrica(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

export function numeroMetricaNullable(valor: unknown): number | null {
  return valor === null ? null : numeroMetrica(valor);
}
