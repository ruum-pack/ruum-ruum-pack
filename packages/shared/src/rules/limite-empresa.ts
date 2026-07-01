import type { RolUsuario } from "../types/usuario";

/**
 * PRD §3 — "Una empresa puede tener máximo dos usuarios internos: titular y
 * usuario autorizado." Es decir: como máximo un titular_empresa y como
 * máximo un usuario_autorizado por empresa (dos en total). Espejo deliberado
 * del trigger validar_limite_empresa() en supabase/migrations/0015_empresas.sql
 * (defensa en profundidad, mismo criterio que nivel_operativo_vigente en 0003):
 * la app sigue siendo la fuente de verdad legible, la base de datos también
 * rechaza el caso aunque el bug esté en la aplicación.
 */
export interface MiembroEmpresa {
  rol: RolUsuario;
}

export function puedeAgregarMiembroEmpresa(
  miembrosActuales: MiembroEmpresa[],
  nuevoRol: "titular_empresa" | "usuario_autorizado"
): boolean {
  const yaTieneEseRol = miembrosActuales.some((m) => m.rol === nuevoRol);
  return !yaTieneEseRol;
}
