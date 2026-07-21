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
  | "pagos:ejecutar" | "conductores:sancionar" | "aprobaciones:aprobar"
  | "auditoria:leer" | "exportaciones:crear" | "capacidades:administrar";

const PERMISOS_POR_ROL: Record<RolAdminOperativo, ReadonlySet<PermisoAdmin>> = {
  operador: new Set(["dashboard:leer", "viajes:leer", "viajes:gestionar", "masivos:gestionar", "conductores:leer", "incidencias:leer"]),
  supervisor: new Set(["dashboard:leer", "viajes:leer", "viajes:gestionar", "masivos:gestionar", "conductores:leer", "conductores:validar", "incidencias:leer", "disputas:leer", "disputas:resolver", "conductores:sancionar", "aprobaciones:aprobar", "auditoria:leer"]),
  finanzas: new Set(["dashboard:leer", "viajes:leer", "pagos:leer", "tarifas:leer", "tarifas:editar", "disputas:leer", "disputas:resolver", "reclamos_seguro:leer", "reclamos_seguro:gestionar", "pagos:ejecutar", "exportaciones:crear"]),
  compliance: new Set(["dashboard:leer", "conductores:leer", "conductores:validar", "usuarios:leer", "usuarios:validar", "empresas:leer", "empresas:gestionar", "incidencias:leer", "reclamos_seguro:leer", "reclamos_seguro:gestionar", "conductores:sancionar", "aprobaciones:aprobar", "auditoria:leer", "exportaciones:crear"]),
  direccion: new Set(["dashboard:leer", "viajes:leer", "viajes:gestionar", "pagos:leer", "tarifas:leer", "tarifas:editar", "incidencias:leer", "disputas:leer", "disputas:resolver", "reclamos_seguro:leer", "reclamos_seguro:gestionar", "pagos:ejecutar", "aprobaciones:aprobar", "auditoria:leer", "exportaciones:crear", "capacidades:administrar"])
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
  const verificarPermiso = cliente.rpc as unknown as (
    fn: "admin_tiene_permiso",
    args: { p_permiso: string }
  ) => Promise<{ data: boolean | null; error: unknown }>;
  const comprobacion = admin
    ? await verificarPermiso("admin_tiene_permiso", { p_permiso: permiso })
    : { data: false, error: null };
  if (comprobacion.error) throw comprobacion.error;
  if (!admin || comprobacion.data !== true) {
    console.warn("[security] permiso administrativo denegado", { userId: autenticacion.user.id, permiso, rol: admin?.rol_operativo ?? null });
    const registrarDenegacion = cliente.rpc as unknown as (
      fn: "registrar_permiso_admin_denegado",
      args: { p_permiso: string; p_motivo: string }
    ) => Promise<unknown>;
    await registrarDenegacion("registrar_permiso_admin_denegado", {
      p_permiso: permiso,
      p_motivo: admin ? "permiso_insuficiente" : "admin_inexistente"
    });
    throw new AdminAuthorizationError(permiso);
  }
  return admin;
}
