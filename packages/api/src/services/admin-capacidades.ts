import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission, type PermisoAdmin } from "./permisos-admin";

type Cliente = SupabaseClient<Database>;
export type AdminColaborador = Pick<Database["public"]["Tables"]["admins"]["Row"], "id" | "nombre" | "rol_operativo" | "creado_en">;

export type CapacidadAdmin = {
  capacidad: string;
  concedida: boolean;
  origen: "rol" | "override";
  motivo: string | null;
  otorgada_por: string | null;
  creada_en: string | null;
};

export async function listarCatalogoCapacidades(cliente: Cliente): Promise<string[]> {
  const rpc = cliente.rpc.bind(cliente) as unknown as (fn: "admin_listar_capacidades_catalogo") => Promise<{ data: string[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_listar_capacidades_catalogo");
  if (error) throw error;
  return data ?? [];
}

export async function listarCapacidadesAdmin(cliente: Cliente, adminId?: string): Promise<CapacidadAdmin[]> {
  const rpc = cliente.rpc.bind(cliente) as unknown as (fn: "admin_listar_capacidades", args: { p_admin_id?: string }) => Promise<{ data: CapacidadAdmin[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_listar_capacidades", { ...(adminId ? { p_admin_id: adminId } : {}) });
  if (error) throw error;
  return data ?? [];
}

export async function concederCapacidadAdmin(cliente: Cliente, adminId: string, capacidad: string, concedida: boolean, motivo: string) {
  await assertAdminPermission(cliente, "capacidades:administrar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_conceder_capacidad",
    args: { p_admin_id: string; p_capacidad: string; p_concedida: boolean; p_motivo: string }
  ) => Promise<{ error: unknown }>;
  const { error } = await rpc("admin_conceder_capacidad", { p_admin_id: adminId, p_capacidad: capacidad, p_concedida: concedida, p_motivo: motivo });
  if (error) throw error;
}

export async function listarColaboradoresAdmin(cliente: Cliente): Promise<AdminColaborador[]> {
  await assertAdminPermission(cliente, "capacidades:administrar");
  const { data, error } = await cliente
    .from("admins")
    .select("id,nombre,rol_operativo,creado_en")
    .order("nombre", { ascending: true })
    .returns<AdminColaborador[]>();
  if (error) throw error;
  return data ?? [];
}

export async function actualizarRolColaboradorAdmin(
  cliente: Cliente,
  adminId: string,
  rol: Database["public"]["Enums"]["rol_admin_operativo"],
  motivo: string
): Promise<AdminColaborador> {
  await assertAdminPermission(cliente, "capacidades:administrar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualizar_rol_colaborador",
    args: { p_admin_id: string; p_rol: Database["public"]["Enums"]["rol_admin_operativo"]; p_motivo: string }
  ) => Promise<{ data: AdminColaborador[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_actualizar_rol_colaborador", { p_admin_id: adminId, p_rol: rol, p_motivo: motivo });
  if (error) throw error;
  const actualizado = data?.[0];
  if (!actualizado) throw new Error("No se recibió el colaborador actualizado.");
  return actualizado;
}
