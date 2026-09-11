import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

export interface EventoOperativoApp {
  tipo: string;
  versionApp: string;
  detalle: unknown;
}

/**
 * FASE 6 — Frontera de observabilidad: telemetría operativa de las apps
 * (tabla eventos_operativos_app). Nunca lanza: la observabilidad no debe
 * romper la operación (las apps conservan su try/catch).
 */
export async function registrarEventoOperativoApp(cliente: Cliente, evento: EventoOperativoApp): Promise<void> {
  const { error } = await cliente.rpc("registrar_evento_operativo_app", {
    p_tipo: evento.tipo,
    p_version_app: evento.versionApp,
    p_detalle: evento.detalle as Json
  });
  if (error) throw error;
}
