import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type VehiculoInsert = Database["public"]["Tables"]["vehiculos"]["Insert"];
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];

/** PRD §4.2 — registra el vehículo a trasladar antes de cotizar. */
export async function crearVehiculo(cliente: Cliente, datos: VehiculoInsert) {
  const { data, error } = await cliente.from("vehiculos").insert(datos).select("id").single();
  if (error) throw error;
  return data;
}

export async function listarVehiculosDeUsuario(cliente: Cliente, usuarioId: string): Promise<VehiculoRow[]> {
  const { data, error } = await cliente
    .from("vehiculos")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
