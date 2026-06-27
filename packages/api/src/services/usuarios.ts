import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

/** Usuario asociado a la sesión de Supabase Auth actual, si existe. */
export async function obtenerUsuarioActual(cliente: Cliente) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", sesion.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
