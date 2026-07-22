import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "./permisos-admin";

type Cliente = SupabaseClient<Database>;

export type ConfiguracionAdmin = {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  valor: unknown;
  version: number;
  actualizada_en: string;
  actualizada_por: string | null;
};

export async function listarConfiguracionAdmin(cliente: Cliente): Promise<ConfiguracionAdmin[]> {
  await assertAdminPermission(cliente, "configuracion:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_listar_configuracion"
  ) => Promise<{ data: ConfiguracionAdmin[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_listar_configuracion");
  if (error) throw error;
  return data ?? [];
}

export async function actualizarConfiguracionAdmin(
  cliente: Cliente,
  clave: string,
  valor: unknown,
  motivo: string,
  versionEsperada: number
): Promise<ConfiguracionAdmin> {
  await assertAdminPermission(cliente, "configuracion:editar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualizar_configuracion",
    args: { p_clave: string; p_valor: unknown; p_motivo: string; p_version_esperada: number }
  ) => Promise<{ data: ConfiguracionAdmin[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_actualizar_configuracion", {
    p_clave: clave,
    p_valor: valor,
    p_motivo: motivo,
    p_version_esperada: versionEsperada
  });
  if (error) throw error;
  const fila = data?.[0];
  if (!fila) throw new Error("La configuración se actualizó sin devolver el registro resultante.");
  return fila;
}
