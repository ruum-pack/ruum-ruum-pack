import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "./permisos-admin";
type Cliente = SupabaseClient<Database>;
export async function obtenerPreferenciaAdmin<T>(cliente: Cliente, clave: string): Promise<T | null> {
  await assertAdminPermission(cliente, "dashboard:leer");
  const { data, error } = await cliente.rpc("obtener_preferencia_admin" as never, { p_clave: clave } as never);
  if (error) throw error;
  return (data ?? null) as T | null;
}
export async function guardarPreferenciaAdmin(cliente: Cliente, clave: string, valor: unknown): Promise<void> {
  await assertAdminPermission(cliente, "dashboard:leer");
  const { error } = await cliente.rpc("guardar_preferencia_admin" as never, { p_clave: clave, p_valor: valor } as never);
  if (error) throw error;
}
