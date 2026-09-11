import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";

type Cliente = SupabaseClient<Database>;
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];

export async function listarIncidenciasAdmin(cliente: Cliente): Promise<IncidenciaRow[]> {
  await assertAdminPermission(cliente, "incidencias:leer");
  const { data, error } = await cliente.from("incidencias").select("*").order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
