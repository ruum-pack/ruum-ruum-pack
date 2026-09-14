/**
 * Fachada: la implementación vive en `@ruum/api/next-browser` (fuente única
 * para las 3 apps). Se conserva esta ruta para no romper call sites.
 * `puedeUsarDatosDemo` es específico del panel y queda aquí.
 */
export {
  tieneSupabaseConfigurado,
  crearClienteNavegadorDesdeEnv as crearClienteNavegador
} from "@ruum/api/next-browser";

export function puedeUsarDatosDemo(): boolean {
  // Nunca inferir demo por ausencia de secretos: debe habilitarse de forma explícita
  // y jamás en un build de producción.
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_PANEL_ADMIN_DEMO === "true";
}
