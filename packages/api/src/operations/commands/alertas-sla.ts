import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission } from "../../services/permisos-admin";
import { type ExcepcionCriticaAdmin } from "../domain/tipos";

type Cliente = SupabaseClient<Database>;

export async function actualizarAlertaSlaAdmin(
  cliente: Cliente,
  alertaId: string,
  accion: "asignar" | "acuse" | "escalar" | "resolver" | "cerrar",
  parametros: { responsable?: string; comentario?: string } = {}
) {
  await assertAdminAnyPermission(cliente, ["incidencias:leer", "viajes:gestionar"]);
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualiza_alerta_sla",
    args: { p_alerta_id: string; p_accion: string; p_responsable: string | null; p_comentario: string | null }
  ) => Promise<{ data: { alerta_id: string; estado: ExcepcionCriticaAdmin["estado"]; responsable: string | null } | null; error: Error | null }>;
  const { data, error } = await rpc("admin_actualiza_alerta_sla", {
    p_alerta_id: alertaId,
    p_accion: accion,
    p_responsable: parametros.responsable ?? null,
    p_comentario: parametros.comentario ?? null
  });
  if (error) throw error;
  return data;
}
