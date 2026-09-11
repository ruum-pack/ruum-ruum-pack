import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { withIdempotentRetry } from "../infrastructure/retry";
import { assertAdminAnyPermission, assertAdminPermission } from "../../services/permisos-admin";

type Cliente = SupabaseClient<Database>;

export async function mutacionConAuditoria(
  cliente: Cliente,
  accion: string,
  trasladoId: string,
  payload: Record<string, unknown> = {}
): Promise<{ ejecutado: boolean; traslado_id: string }> {
  await assertAdminPermission(cliente, "viajes:gestionar");
  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_mutacion_con_auditoria",
      args: { p_accion: string; p_traslado_id: string; p_payload: Record<string, unknown> }
    ) => Promise<{ data: { ejecutado: boolean; traslado_id: string } | null; error: unknown }>;
    const { data, error } = await rpc("admin_mutacion_con_auditoria", {
      p_accion: accion,
      p_traslado_id: trasladoId,
      p_payload: payload
    });
    if (error) throw error;
    if (!data) throw new Error("No se pudo ejecutar la mutación.");
    return data;
  });
}
