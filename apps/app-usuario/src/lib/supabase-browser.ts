/**
 * Fachada: la implementación vive en `@ruum/api/next-browser` (fuente única
 * para las 3 apps). Se conserva esta ruta para no romper call sites ni
 * mocks de tests (`@/lib/supabase-browser`).
 */
export {
  tieneSupabaseConfigurado,
  crearClienteNavegadorDesdeEnv as crearClienteNavegador
} from "@ruum/api/next-browser";
