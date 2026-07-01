import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type VehiculoInsert = Database["public"]["Tables"]["vehiculos"]["Insert"];

/** PRD §4.2 — registra el vehículo a trasladar antes de cotizar. */
export async function crearVehiculo(cliente: Cliente, datos: VehiculoInsert) {
  const { data, error } = await cliente.from("vehiculos").insert(datos).select("id").single();
  if (error) throw error;
  return data;
}
