import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

export async function obtenerAdminActual(cliente: Cliente) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente.from("admins").select("*").eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function obtenerAdminIdParaAuditoria(cliente: Cliente): Promise<string> {
  const admin = await obtenerAdminActual(cliente);
  if (!admin) {
    throw new Error("No se encontró un admin autenticado para registrar auditoría.");
  }
  return admin.id;
}

export interface AdminBasico { id: string; nombre: string; rol_operativo: string | null }
/** FASE 6 cierre — catálogo mínimo para capacidades, protegido por RLS. */
export async function listarAdminsBasicos(cliente: Cliente): Promise<AdminBasico[]> {
  const { data, error } = await cliente.from("admins").select("id,nombre,rol_operativo");
  if (error) throw error;
  return (data ?? []) as AdminBasico[];
}
