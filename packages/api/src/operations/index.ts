/**
 * FASE 5 — Dominio operations (Torre de Control).
 * Primera extracción desde services/admin.ts (5.3): tablero, mapa, excepciones,
 * alertas SLA, auditoría operativa y acciones masivas.
 * `schemas/`, `application/` e `infrastructure/` adicional se añaden cuando el
 * dominio los necesite (la validación vive hoy en zod + shared/validacion).
 */
export * from "./domain/tipos";
export * from "./queries/dashboard";
export * from "./queries/mapa";
export * from "./queries/excepciones";
export * from "./queries/alertas-sla";
export * from "./queries/auditoria";
export * from "./queries/torre";
export * from "./queries/observabilidad";
export * from "./queries/feature-flags";
export * from "./exports";
export * from "./commands/acciones-masivas";
export * from "./commands/alertas-sla";
export * from "./commands/auditoria";
export * from "./infrastructure/retry";
export * from "./infrastructure/metricas";
