import type { RolUsuario } from "../types/usuario";

/**
 * PRD §3 (modelo legacy) — "Una empresa puede tener máximo dos usuarios
 * internos: titular y usuario autorizado."
 *
 * @deprecated FASE 2: el límite de 2 se eliminó en DB (drop del trigger
 * validar_limite_empresa en 20260908000002_equipo_empresa.sql). La autoridad
 * ahora es empresa_miembros + empresa_rol_permisos (ver types/empresa-equipo.ts).
 * Se conserva sin cambios por compatibilidad con código que aún distingue los
 * roles legacy titular_empresa/usuario_autorizado.
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
