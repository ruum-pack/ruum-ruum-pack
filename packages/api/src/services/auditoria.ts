import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";
import { normalizarError } from "./errores";

type Cliente = SupabaseClient<Database>;
type EventoAuditable = Database["public"]["Enums"]["evento_auditable"];
type ActorAuditoria = Database["public"]["Enums"]["actor_auditoria"];
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];
type DatosAuditoria = { [key: string]: Json | undefined };

export function generarTraceId(): string {
  return crypto.randomUUID();
}

const CAMPOS_SENSIBLES = new Set([
  "auth_user_id", "token", "secret", "password", "cvv", "card_number",
  "numero_tarjeta", "cvv2", "pin", "refresh_token", "session_id",
  "cookie", "authorization", "api_key", "api_secret"
]);

function sanitizarDatosAuditoria(datos: DatosAuditoria): DatosAuditoria {
  const limpios: DatosAuditoria = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (CAMPOS_SENSIBLES.has(clave)) {
      limpios[clave] = "[REDACTED]";
    } else if (typeof valor === "object" && valor !== null && !Array.isArray(valor)) {
      limpios[clave] = sanitizarDatosAuditoria(valor as DatosAuditoria);
    } else {
      limpios[clave] = valor;
    }
  }
  return limpios;
}

export async function registrarEvento(
  cliente: Cliente,
  evento: EventoAuditable,
  actor: ActorAuditoria,
  actorId: string,
  datos: DatosAuditoria = {},
  traceId?: string
) {
  const trasladoId = typeof datos.traslado_id === "string" ? datos.traslado_id : null;
  const datosConTraza: DatosAuditoria = traceId ? { ...datos, trace_id: traceId } : datos;
  const { error } = await cliente.from("registro_auditoria").insert({
    traslado_id: trasladoId,
    evento,
    actor,
    actor_id: actorId,
    datos: sanitizarDatosAuditoria(datosConTraza) as Json
  });

  if (error) throw error;
}

export async function obtenerAuditoriaTraslado(cliente: Cliente, trasladoId: string): Promise<AuditoriaRow[]> {
  const { data, error } = await cliente
    .from("registro_auditoria")
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("timestamp", { ascending: false });

  if (error) throw normalizarError(error);
  return data ?? [];
}

export async function obtenerAlertasEmergenciaAdmin(cliente: Cliente): Promise<AuditoriaRow[]> {
  const { data, error } = await cliente
    .from("registro_auditoria")
    .select("*")
    .eq("evento", "activacion_soporte_emergencia")
    .order("timestamp", { ascending: false })
    .limit(10);

  if (error) throw normalizarError(error);
  return data ?? [];
}
