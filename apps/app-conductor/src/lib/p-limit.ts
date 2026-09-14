/**
 * Fachada: la implementación vive en `@ruum/shared/utils` (fuente única,
 * PERF-004). Se conserva esta ruta para no romper el test `test/p-limit.test.ts`.
 */
export { pLimit, type Limit } from "@ruum/shared/utils";
