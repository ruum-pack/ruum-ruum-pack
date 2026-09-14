/**
 * Fachada: la implementación vive en `@ruum/api/next-server` (fuente única
 * para las 3 apps). Se conserva esta ruta para no romper call sites.
 */
export { crearClienteServidorDesdeCookies as crearClienteServidor } from "@ruum/api/next-server";
