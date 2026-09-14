/**
 * Fachada: la implementación vive en `@ruum/api/next-server` (fuente única
 * para las 3 apps). Se conserva esta ruta para no romper los ~100 call
 * sites y los mocks de tests (`@/lib/supabase-server`).
 */
export { crearClienteServidorDesdeCookies as crearClienteServidor } from "@ruum/api/next-server";
