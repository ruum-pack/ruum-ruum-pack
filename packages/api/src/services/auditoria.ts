import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type EventoAuditable = Database["public"]["Enums"]["evento_auditable"];
type ActorAuditoria = Database["public"]["Enums"]["actor_auditoria"];
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];
type DatosAuditoria = { [key: string]: Json | undefined };

export async function registrarEvento(
  cliente: Cliente,
  evento: EventoAuditable,
  actor: ActorAuditoria,
  actorId: string,
  datos: DatosAuditoria = {}
) {
  const trasladoId = typeof datos.traslado_id === "string" ? datos.traslado_id : null;
  const { error } = await cliente.from("registro_auditoria").insert({
    traslado_id: trasladoId,
    evento,
    actor,
    actor_id: actorId,
    datos
  });

  if (error) throw error;
}

export async function obtenerAuditoriaTraslado(cliente: Cliente, trasladoId: string): Promise<AuditoriaRow[]> {
  const { data, error } = await cliente
    .from("registro_auditoria")
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("timestamp", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function obtenerAlertasEmergenciaAdmin(cliente: Cliente): Promise<AuditoriaRow[]> {
  const { data, error } = await cliente
    .from("registro_auditoria")
    .select("*")
    .eq("evento", "activacion_soporte_emergencia")
    .order("timestamp", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
}
