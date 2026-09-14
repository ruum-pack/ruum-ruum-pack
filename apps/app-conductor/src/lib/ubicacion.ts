/**
 * Fachada: la implementación vive en `@ruum/api/ubicacion` (fuente única).
 * Se conserva esta ruta para no romper call sites ni mocks de tests.
 */
export {
  distanciaMetrosEntre,
  obtenerUbicacionActual,
  obtenerUbicacionActualConEstado,
  observarUbicacionActual,
  type Coordenadas,
  type ResultadoUbicacion,
  type CancelarObservacionUbicacion
} from "@ruum/api/ubicacion";
