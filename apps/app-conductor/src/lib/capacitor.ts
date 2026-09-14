/**
 * Fachada: la implementación vive en `@ruum/api/capacitor` (fuente única).
 * Se conserva esta ruta para no romper call sites ni mocks de tests.
 */
export { esNativo, plataformaActual } from "@ruum/api/capacitor";
