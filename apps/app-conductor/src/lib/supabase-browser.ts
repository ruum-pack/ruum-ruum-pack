/**
 * Fachada: la implementación vive en `@ruum/api/next-browser` (fuente única
 * para las 3 apps). Se conserva esta ruta para no romper los ~100 call
 * sites y los mocks de tests (`@/lib/supabase-browser`).
 */
export {
  tieneSupabaseConfigurado,
  obtenerOriginApp,
  crearClienteNavegadorDesdeEnv as crearClienteNavegador
} from "@ruum/api/next-browser";
