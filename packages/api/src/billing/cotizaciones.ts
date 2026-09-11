import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

export async function emitirCotizacionAdmin(cliente: Cliente, trasladoId: string, precio: number) {
  if (!Number.isFinite(precio) || precio <= 0) throw new Error("La tarifa normativa debe ser mayor a cero.");
  const { error } = await cliente.rpc("admin_emite_cotizacion", { p_traslado_id: trasladoId, p_precio: precio });
  if (error) throw error;
}

export async function aplicarTarifaNormativaAdmin(cliente: Cliente, trasladoId: string): Promise<number> {
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_aplica_tarifa_normativa",
    args: { p_traslado_id: string }
  ) => Promise<{ data: number | null; error: Error | null }>;
  const { data, error } = await rpc("admin_aplica_tarifa_normativa", { p_traslado_id: trasladoId });
  if (error) throw error;
  if (data == null) throw new Error("No se pudo confirmar la tarifa normativa aplicada.");
  return data;
}
