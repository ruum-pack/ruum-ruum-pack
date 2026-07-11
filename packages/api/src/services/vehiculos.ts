import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];

// No hay crearVehiculo() suelto a propósito (sprint 1, 2026-07-11): el
// INSERT directo en `vehiculos` se cerró por RLS. Un vehículo nuevo solo
// puede nacer dentro de usuario_crea_traslado() (services/traslados.ts),
// que es la única vía que también valida año y candado de propiedad al
// reutilizar uno guardado. Ver migración 20260711000118.

export async function listarVehiculosDeUsuario(cliente: Cliente, usuarioId: string): Promise<VehiculoRow[]> {
  const { data, error } = await cliente
    .from("vehiculos")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
