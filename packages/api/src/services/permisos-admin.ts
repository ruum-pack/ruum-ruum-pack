import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
export type RolAdminOperativo = Database["public"]["Enums"]["rol_admin_operativo"];

export type PermisoAdmin =
  | "dashboard:leer" | "viajes:leer" | "viajes:gestionar" | "masivos:gestionar"
  | "conductores:leer" | "conductores:validar" | "usuarios:leer" | "usuarios:validar"
  | "empresas:leer" | "empresas:gestionar" | "pagos:leer" | "tarifas:leer"
  | "tarifas:editar" | "incidencias:leer" | "disputas:leer" | "disputas:resolver"
  | "reclamos_seguro:leer" | "reclamos_seguro:gestionar"
  | "pagos:ejecutar" | "pagos:exportar" | "conductores:sancionar" | "aprobaciones:aprobar"
  | "auditoria:leer" | "exportaciones:crear" | "capacidades:administrar"
  | "configuracion:leer" | "configuracion:editar";

const PERMISOS_POR_ROL: Record<RolAdminOperativo, ReadonlySet<PermisoAdmin>> = {
  operador: new Set(["dashboard:leer", "viajes:leer", "viajes:gestionar", "masivos:gestionar", "conductores:leer", "incidencias:leer"]),
  supervisor: new Set(["dashboard:leer", "viajes:leer", "viajes:gestionar", "masivos:gestionar", "conductores:leer", "conductores:validar", "incidencias:leer", "disputas:leer", "disputas:resolver", "conductores:sancionar", "aprobaciones:aprobar", "auditoria:leer"]),
  finanzas: new Set(["dashboard:leer", "viajes:leer", "pagos:leer", "pagos:exportar", "tarifas:leer", "tarifas:editar", "disputas:leer", "disputas:resolver", "reclamos_seguro:leer", "reclamos_seguro:gestionar", "pagos:ejecutar", "exportaciones:crear"]),
  compliance: new Set(["dashboard:leer", "conductores:leer", "conductores:validar", "usuarios:leer", "usuarios:validar", "empresas:leer", "empresas:gestionar", "incidencias:leer", "reclamos_seguro:leer", "reclamos_seguro:gestionar", "conductores:sancionar", "aprobaciones:aprobar", "auditoria:leer", "exportaciones:crear"]),
  direccion: new Set(["dashboard:leer", "viajes:leer", "viajes:gestionar", "masivos:gestionar", "conductores:leer", "conductores:validar", "conductores:sancionar", "usuarios:leer", "usuarios:validar", "empresas:leer", "empresas:gestionar", "pagos:leer", "pagos:ejecutar", "pagos:exportar", "tarifas:leer", "tarifas:editar", "incidencias:leer", "disputas:leer", "disputas:resolver", "reclamos_seguro:leer", "reclamos_seguro:gestionar", "aprobaciones:aprobar", "auditoria:leer", "exportaciones:crear", "capacidades:administrar", "configuracion:leer", "configuracion:editar"])
};

export class AdminAuthorizationError extends Error {
  readonly code = "ADMIN_PERMISSION_DENIED";
  constructor(readonly permiso: PermisoAdmin) {
    super(`Permiso administrativo requerido: ${permiso}.`);
    this.name = "AdminAuthorizationError";
  }
}

export function rolAdminTienePermiso(rol: RolAdminOperativo, permiso: PermisoAdmin): boolean {
  return PERMISOS_POR_ROL[rol].has(permiso);
}

export async function assertAdminPermission(cliente: Cliente, permiso: PermisoAdmin) {
  const { data: autenticacion, error: errorAutenticacion } = await cliente.auth.getUser();
  if (errorAutenticacion || !autenticacion.user) throw new Error("No hay una sesión administrativa válida.");

  const { data: admin, error } = await cliente.from("admins").select("id,rol_operativo").eq("auth_user_id", autenticacion.user.id).maybeSingle();
  if (error) throw error;
  const { data: comprobacionPermiso, error: errorPermiso } = admin
    ? await cliente.rpc("admin_tiene_permiso", { p_permiso: permiso })
    : { data: false as const, error: null };
  if (errorPermiso) throw errorPermiso;
  if (!admin || comprobacionPermiso !== true) {
    console.warn("[security] permiso administrativo denegado", { userId: autenticacion.user.id, permiso, rol: admin?.rol_operativo ?? null });
    await cliente.rpc("registrar_permiso_admin_denegado", {
      p_permiso: permiso,
      p_motivo: admin ? "permiso_insuficiente" : "admin_inexistente"
    });
    throw new AdminAuthorizationError(permiso);
  }
  return admin;
}
