/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Recibe los webhooks de Didit (status.updated / decision.updated) y
// resuelve automáticamente la solicitud del conductor.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-signature, x-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function firmaValida(payloadCrudo: string, firmaHeader: string | null, timestampHeader: string | null, secreto: string): Promise<boolean> {
  if (!firmaHeader || !timestampHeader || !secreto) return false;

  const ahora = Math.floor(Date.now() / 1000);
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(ahora - ts) > 300) return false;

  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const firmaCalculada = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(payloadCrudo));
  const hex = Array.from(new Uint8Array(firmaCalculada), (b) => b.toString(16).padStart(2, "0")).join("");

  if (hex.length !== firmaHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i += 1) diff |= hex.charCodeAt(i) ^ firmaHeader.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";
  if (!url || !serviceKey || !webhookSecret) {
    console.error("webhook-didit sin configurar");
    return json({ error: "Servicio no configurado." }, 500);
  }

  const payloadCrudo = await req.text();
  const firma = req.headers.get("x-signature-v2") ?? req.headers.get("X-Signature-V2") ?? req.headers.get("x-signature") ?? req.headers.get("X-Signature");
  const timestamp = req.headers.get("x-timestamp") ?? req.headers.get("X-Timestamp");
  if (!(await firmaValida(payloadCrudo, firma, timestamp, webhookSecret))) {
    console.error("Firma de webhook Didit inválida");
    return json({ error: "Firma inválida." }, 401);
  }

  let evento: {
    session_id?: string;
    sessionId?: string;
    id?: string;
    status?: string;
    event?: string;
    vendor_data?: string;
    vendorData?: string;
    decision?: unknown;
  };
  try {
    evento = JSON.parse(payloadCrudo);
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const sessionId = evento.session_id ?? evento.sessionId ?? evento.id;
  const estadoDiditRaw = (evento.status ?? evento.event ?? "").toString().toLowerCase().trim();
  const solicitudId = evento.vendor_data ?? evento.vendorData;
  if (!sessionId || !solicitudId) return json({ error: "Payload incompleto." }, 400);

  const servicio = createClient(url, serviceKey);

  // Mapeo de estados Didit normalizados -> estados internos
  let estadoInterno: string;
  let esAprobado = false;
  let esRechazado = false;
  let esTerminal = false;

  if (estadoDiditRaw === "approved" || estadoDiditRaw === "completed" || estadoDiditRaw === "verification.completed") {
    estadoInterno = "aprobado";
    esAprobado = true;
  } else if (estadoDiditRaw === "declined" || estadoDiditRaw === "rejected") {
    estadoInterno = "rechazado";
    esRechazado = true;
  } else if (estadoDiditRaw === "in review" || estadoDiditRaw === "in_review" || estadoDiditRaw === "review") {
    estadoInterno = "en_revision";
  } else if (estadoDiditRaw === "expired") {
    estadoInterno = "expirado";
    esTerminal = true;
  } else if (estadoDiditRaw === "cancelled" || estadoDiditRaw === "canceled") {
    estadoInterno = "cancelado";
    esTerminal = true;
  } else if (estadoDiditRaw === "error" || estadoDiditRaw === "failed") {
    estadoInterno = "error";
    esTerminal = true;
  } else {
    estadoInterno = "pendiente";
  }

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
    if (esAprobado) {
      const { error } = await servicio.rpc("aprobar_solicitud_conductor_sistema", {
        p_solicitud_id: verificacion.solicitud_id,
        p_verificacion_id: verificacion.id,
      });
      if (error) throw error;
    } else if (esRechazado) {
      const { error } = await servicio.rpc("rechazar_solicitud_por_verificacion_sistema", {
        p_solicitud_id: verificacion.solicitud_id,
        p_verificacion_id: verificacion.id,
      });
      if (error) throw error;
    } else if (esTerminal) {
      // Para estados terminales (Expired, Cancelled, Error), marcamos la verificación
      // como procesada pero NO llamamos a RPCs de aprobación/rechazo.
      // El usuario podrá reintentar la verificación desde el panel.
      await servicio
        .from("verificaciones_identidad_didit")
        .update({ procesado_en: new Date().toISOString() })
        .eq("id", verificacion.id);
      console.log(`Verificación Didit ${estadoDiditRaw} registrada para sesión ${sessionId}, solicitud ${solicitudId}`);
    }
  } catch (error) {
    console.error("Error aplicando decisión Didit", error instanceof Error ? error.message : error);
    await servicio.from("verificaciones_identidad_didit").update({ estado: "error" }).eq("id", verificacion.id);
    return json({ recibido: true, error_procesando: true }, 200);
  }

  return json({ recibido: true, estado: estadoInterno }, 200);
});