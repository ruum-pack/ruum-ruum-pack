/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Recibe los webhooks de Didit (status.updated / decision.updated) y
// resuelve automáticamente la solicitud del conductor:
//   - Approved  -> aprobar_solicitud_conductor_sistema (crea al conductor,
//                  avanza el expediente completo hasta 'aprobado').
//   - Declined  -> rechazar_solicitud_por_verificacion_sistema (pide
//                  corrección, igual que un admin rechazando documentos).
//   - In Review -> se deja para revisión humana en el panel admin, tal
//                  como funciona hoy.
//
// Configura esta URL como destino de webhook en el dashboard de Didit
// (Settings -> Webhooks) para la app "Ruum-Ruum (Sandbox)", y copia el
// signing secret a la variable de entorno DIDIT_WEBHOOK_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function firmaValida(payloadCrudo: string, firmaHeader: string | null, timestampHeader: string | null, secreto: string): Promise<boolean> {
  if (!firmaHeader || !timestampHeader || !secreto) return false;
  // Ventana de tolerancia de 5 minutos contra ataques de repetición.
  const ahora = Math.floor(Date.now() / 1000);
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(ahora - ts) > 300) return false;

  const clave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const firmaCalculada = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(payloadCrudo));
  const hex = Array.from(new Uint8Array(firmaCalculada), (b) => b.toString(16).padStart(2, "0")).join("");
  // Comparación en tiempo constante.
  if (hex.length !== firmaHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ firmaHeader.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";
  if (!url || !serviceKey || !webhookSecret) {
    console.error("webhook-didit sin configurar");
    return json({ error: "Servicio no configurado." }, 500);
  }

  const payloadCrudo = await req.text();
  const firma = req.headers.get("x-signature") ?? req.headers.get("X-Signature");
  const timestamp = req.headers.get("x-timestamp") ?? req.headers.get("X-Timestamp");
  if (!(await firmaValida(payloadCrudo, firma, timestamp, webhookSecret))) {
    console.error("Firma de webhook Didit inválida");
    return json({ error: "Firma inválida." }, 401);
  }

  let evento: {
    session_id?: string;
    status?: string;
    vendor_data?: string;
    decision?: unknown;
  };
  try { evento = JSON.parse(payloadCrudo); } catch { return json({ error: "JSON inválido." }, 400); }

  const sessionId = evento.session_id;
  const estadoDidit = (evento.status ?? "").toString();
  const solicitudId = evento.vendor_data;
  if (!sessionId || !solicitudId) return json({ error: "Payload incompleto." }, 400);

  // Sólo procesamos estados terminales; los intermedios (In Progress, Not
  // Started) simplemente se ignoran, Didit reenviará el siguiente evento.
  if (!["Approved", "Declined", "In Review"].includes(estadoDidit)) {
    return json({ recibido: true, ignorado: estadoDidit }, 200);
  }

  const servicio = createClient(url, serviceKey);

  const estadoInterno = estadoDidit === "Approved" ? "aprobado" : estadoDidit === "Declined" ? "rechazado" : "en_revision";

  const { data: verificacion, error: errorUpdate } = await servicio
    .from("verificaciones_identidad_didit")
    .update({ estado: estadoInterno, decision: evento.decision ?? evento })
    .eq("session_id", sessionId)
    .select("id,solicitud_id,estado")
    .maybeSingle();
  if (errorUpdate || !verificacion) {
    console.error("No se encontró la verificación para session_id", sessionId, errorUpdate?.message);
    return json({ error: "Verificación no encontrada." }, 404);
  }

  try {
    if (estadoDidit === "Approved") {
      const { error } = await servicio.rpc("aprobar_solicitud_conductor_sistema", {
        p_solicitud_id: verificacion.solicitud_id,
        p_verificacion_id: verificacion.id,
      });
      if (error) throw error;
    } else if (estadoDidit === "Declined") {
      const { error } = await servicio.rpc("rechazar_solicitud_por_verificacion_sistema", {
        p_solicitud_id: verificacion.solicitud_id,
        p_verificacion_id: verificacion.id,
      });
      if (error) throw error;
    }
    // "In Review": no se toca la solicitud; queda visible en /aprobaciones
    // del panel admin para revisión humana, como ya funciona hoy.
  } catch (error) {
    // No reventamos el webhook con 500 en bucle: registramos el error y
    // dejamos la verificación marcada para que el admin la revise a mano.
    console.error("Error aplicando decisión Didit", error instanceof Error ? error.message : error);
    await servicio.from("verificaciones_identidad_didit").update({ estado: "error" }).eq("id", verificacion.id);
    return json({ recibido: true, error_procesando: true }, 200);
  }

  return json({ recibido: true, estado: estadoInterno }, 200);
});