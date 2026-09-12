import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { rpcValidado } from "../../services/_rpc-validado";

// FASE 6 (cierre) — Guard de autorización del panel-admin: el middleware ya
// no consulta `admins` ni invoca `admin_tiene_permiso` /
// `registrar_acceso_admin_denegado` directamente. Recibe el cliente ya
// creado (con cookies) y el user id resuelto por `auth.getUser()`.

type Cliente = SupabaseClient<Database>;

export interface AdminSesion {
  id: string;
  rol_operativo: string | null;
}

const esquemaAdmin = z.object({
  id: z.string().uuid(),
  rol_operativo: z.string().nullable()
});

const esquemaDenegado = z.object({
  p_ruta: z.string().trim().min(1).max(200),
  p_metodo: z.string().trim().min(1).max(16),
  p_motivo: z.string().trim().min(1).max(120)
});

const esquemaPermiso = z.object({
  p_permiso: z.string().trim().min(1).max(60)
});

export async function obtenerAdminSesion(
  cliente: Cliente,
  authUserId: string
): Promise<AdminSesion | null> {
  const { data, error } = await cliente
    .from("admins")
    .select("id,rol_operativo")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return esquemaAdmin.parse({ id: (data as { id: string }).id, rol_operativo: (data as { rol_operativo: string | null }).rol_operativo });
}

export async function verificarPermisoRuta(cliente: Cliente, permiso: string): Promise<boolean> {
  const { data, error } = await rpcValidado(cliente, "admin_tiene_permiso", esquemaPermiso, {
    p_permiso: permiso
  });
  if (error) throw error;
  return data === true;
}

export async function registrarAccesoDenegado(
  cliente: Cliente,
  params: { ruta: string; metodo: string; motivo: string }
): Promise<void> {
  const { error } = await rpcValidado(cliente, "registrar_acceso_admin_denegado", esquemaDenegado, {
    p_ruta: params.ruta,
    p_metodo: params.metodo,
    p_motivo: params.motivo
  });
  if (error) throw error;
}
