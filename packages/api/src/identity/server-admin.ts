import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type RecursoCuenta = "usuario" | "conductor";
type RolAdminOperativo = Database["public"]["Enums"]["rol_admin_operativo"];

/** FASE 6 cierre — operaciones server-side con service role encapsuladas en @ruum/api. */
export async function crearPerfilConductorService(
  cliente: Cliente,
  datos: Database["public"]["Tables"]["conductores"]["Insert"]
) {
  const { data, error } = await cliente.from("conductores").insert(datos).select("*").single();
  if (error) throw error;
  return data;
}

export async function eliminarPerfilConductorService(cliente: Cliente, conductorId: string): Promise<void> {
  const { error } = await cliente.from("conductores").delete().eq("id", conductorId);
  if (error) throw error;
}

export async function obtenerAuthUserIdSolicitudConductorService(cliente: Cliente, solicitudId: string): Promise<string | null> {
  const { data, error } = await cliente.from("solicitudes_conductor").select("auth_user_id").eq("id", solicitudId).maybeSingle();
  if (error) throw error;
  return data?.auth_user_id ?? null;
}

export async function obtenerAuthUserIdRecursoService(cliente: Cliente, recurso: RecursoCuenta, id: string): Promise<string | null> {
  if (recurso === "usuario") {
    const { data, error } = await cliente.from("usuarios").select("auth_user_id").eq("id", id).maybeSingle();
    if (error) throw error;
    return data?.auth_user_id ?? null;
  }
  const { data, error } = await cliente.from("conductores").select("auth_user_id").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.auth_user_id ?? null;
}

export async function crearPerfilAdminService(cliente: Cliente, datos: { auth_user_id: string; nombre: string; rol_operativo: RolAdminOperativo }) {
  const { data, error } = await cliente.from("admins").insert(datos).select("id,nombre,rol_operativo,creado_en").single();
  if (error) throw error;
  return data;
}

export async function obtenerActorAdminService(cliente: Cliente, authUserId: string): Promise<{ id: string; rol_operativo: RolAdminOperativo | null } | null> {
  const { data, error } = await cliente.from("admins").select("id,rol_operativo").eq("auth_user_id", authUserId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function registrarAuditoriaInvitacionAdminService(cliente: Cliente, params: {
  authUserId: string;
  adminId: string | null;
  rol: RolAdminOperativo | null;
  motivo: string;
  adminObjetivoId: string;
  rolObjetivo: RolAdminOperativo;
}): Promise<void> {
  const { error } = await cliente.from("auditoria_admin_seguridad").insert({
    auth_user_id: params.authUserId,
    admin_id: params.adminId,
    rol: params.rol,
    tipo: "mutacion",
    recurso: "admins",
    accion: "invitar_admin_panel",
    motivo: params.motivo,
    datos: {
      admin_objetivo_id: params.adminObjetivoId,
      rol_operativo: params.rolObjetivo,
      correo: "[REDACTED]",
      auth_user_id: "[REDACTED]"
    } as Json
  });
  if (error) throw error;
}

export async function eliminarPerfilAdminService(cliente: Cliente, adminId: string): Promise<void> {
  const { error } = await cliente.from("admins").delete().eq("id", adminId);
  if (error) throw error;
}

export async function upsertPerfilUsuarioInvitadoService(
  cliente: Cliente,
  datos: Database["public"]["Tables"]["usuarios"]["Insert"]
): Promise<{ id: string }> {
  const { data, error } = await cliente.from("usuarios").upsert(datos, { onConflict: "auth_user_id" }).select("id").single();
  if (error) throw error;
  return data;
}
