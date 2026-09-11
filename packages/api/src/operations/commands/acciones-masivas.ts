import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "../../services/permisos-admin";
import { type ResultadoAccionMasivaGlobal } from "../domain/tipos";
import { withIdempotentRetry } from "../infrastructure/retry";

type Cliente = SupabaseClient<Database>;

export async function ejecutarAccionMasiva(
  cliente: Cliente,
  accion: string,
  trasladoIds: string[],
  payload: Record<string, unknown> = {}
): Promise<ResultadoAccionMasivaGlobal> {
  await assertAdminPermission(cliente, "viajes:gestionar");
  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_accion_masiva",
      args: { p_accion: string; p_traslado_ids: string[]; p_payload: Record<string, unknown> }
    ) => Promise<{ data: ResultadoAccionMasivaGlobal | null; error: unknown }>;
    const { data, error } = await rpc("admin_accion_masiva", {
      p_accion: accion,
      p_traslado_ids: trasladoIds,
      p_payload: payload
    });
    if (error) throw error;
    if (!data) throw new Error("No se pudo ejecutar la acción masiva.");
    return data;
  });
}
