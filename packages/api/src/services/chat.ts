import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type MensajeRow = Database["public"]["Tables"]["mensajes_chat"]["Row"];
type RemitenteChat = Database["public"]["Enums"]["remitente_chat"];

/** PRD §4.12 — historial del chat de un traslado, más antiguo primero. */
export async function obtenerMensajes(cliente: Cliente, trasladoId: string): Promise<MensajeRow[]> {
  const { data, error } = await cliente
    .from("mensajes_chat")
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("enviado_en", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function enviarMensaje(cliente: Cliente, trasladoId: string, remitente: RemitenteChat, contenido: string) {
  const { error } = await cliente.from("mensajes_chat").insert({ traslado_id: trasladoId, remitente, contenido });
  if (error) throw error;
}

/**
 * PRD §4.12 — el chat debe sentirse en vivo, no como un formulario que hay
 * que recargar. Usa Supabase Realtime (Postgres Changes) en vez de polling.
 * Devuelve el canal para que quien llame lo desuscriba en su cleanup de
 * useEffect — esta función no se desuscribe sola.
 */
export function suscribirseAMensajes(
  cliente: Cliente,
  trasladoId: string,
  alRecibir: (mensaje: MensajeRow) => void
): RealtimeChannel {
  return cliente
    .channel(`mensajes_chat:${trasladoId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "mensajes_chat", filter: `traslado_id=eq.${trasladoId}` },
      (payload) => alRecibir(payload.new as MensajeRow)
    )
    .subscribe();
}

/**
 * PRD §4.12 — invoca la Edge Function que crea/reutiliza la sesión de
 * Twilio Proxy y devuelve el número virtual real al que hay que llamar.
 * El llamado real lo hace el navegador/dispositivo (enlace `tel:`), esto
 * solo obtiene el número — no hay softphone embebido en la app.
 */
export async function crearLlamadaEnmascarada(cliente: Cliente, trasladoId: string): Promise<string> {
  const { data, error } = await cliente.functions.invoke("crear-llamada-enmascarada", {
    body: { traslado_id: trasladoId }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.numeroProxy as string;
}
