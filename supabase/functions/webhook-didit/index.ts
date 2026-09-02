/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Recibe los webhooks de Didit (status.updated / decision.updated) y
// resuelve automáticamente la solicitud del conductor o la cuenta del usuario.

import { createClient } from "npm:@supabase/supabase-js@2";
import { validarFirmaWebhookDidit } from "../_shared/didit-webhook.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-signature, x-signature-v2, x-signature-simple, x-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("DIDIT_WEBHOOK_SECRET") ?? "";
  if (!url || !serviceKey || !webhookSecret) {
    console.error("webhook-didit sin configurar");
    return json({ error: "Servicio no configurado." }, 500);
  }

  const payloadCrudo = await req.text();
  let evento: {
    event_id?: string;
    webhook_type?: string;
    timestamp?: number | string;
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

  const timestamp = req.headers.get("x-timestamp");
  const validacionFirma = await validarFirmaWebhookDidit({
    payloadCrudo,
    evento,
    firmaV2: req.headers.get("x-signature-v2"),
    firmaRaw: req.headers.get("x-signature"),
    firmaSimple: req.headers.get("x-signature-simple"),
    timestamp,
    secreto: webhookSecret,
  });
  if (!validacionFirma.valida) {
    console.error("Firma de webhook Didit inválida");
    return json({ error: "Firma inválida." }, 401);
  }

  if (
    evento.webhook_type &&
    !["status.updated", "data.updated"].includes(evento.webhook_type)
  ) {
    return json({ recibido: true, ignorado: true }, 200);
  }

  const sessionId = evento.session_id ?? evento.sessionId ?? evento.id;
  const estadoDiditRaw = (evento.status ?? evento.event ?? "").toString()
    .toLowerCase().trim();
  if (!sessionId) {
    return json({ error: "Payload incompleto (falta sessionId)." }, 400);
  }

  const servicio = createClient(url, serviceKey);

  // Mapeo de estados Didit normalizados -> estados internos
  let estadoInterno: string;
  let esAprobado = false;
  let esRechazado = false;
  let esTerminal = false;

  if (
    estadoDiditRaw === "approved" || estadoDiditRaw === "completed" ||
    estadoDiditRaw === "verification.completed"
  ) {
    estadoInterno = "aprobado";
    esAprobado = true;
  } else if (estadoDiditRaw === "declined" || estadoDiditRaw === "rejected") {
    estadoInterno = "rechazado";
    esRechazado = true;
  } else if (
    estadoDiditRaw === "in review" || estadoDiditRaw === "in_review" ||
    estadoDiditRaw === "review"
  ) {
    estadoInterno = "en_revision";
  } else if (estadoDiditRaw === "expired" || estadoDiditRaw === "kyc expired") {
    estadoInterno = "expirado";
    esTerminal = true;
  } else if (
    estadoDiditRaw === "abandoned" || estadoDiditRaw === "cancelled" ||
    estadoDiditRaw === "canceled"
  ) {
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
    .update({
      estado: estadoInterno,
      // X-Signature-Simple no firma decision. No persistir esa parte del
      // payload cuando se usa el fallback compatible con middleware.
      decision: validacionFirma.decisionAutenticada
        ? evento.decision ?? evento
        : null,
    })
    .eq("session_id", sessionId)
    .select("id,solicitud_id,usuario_id,estado,procesado_en")
    .maybeSingle();

  if (errorUpdate || !verificacion) {
    console.error(
      "No se encontró la verificación para session_id",
      sessionId,
      errorUpdate?.message,
    );
    return json({ error: "Verificación no encontrada." }, 404);
  }

  if (verificacion.procesado_en) {
    return json({
      recibido: true,
      duplicado: true,
      estado: verificacion.estado,
    }, 200);
  }

  try {
    if (verificacion.usuario_id) {
      // Flujo de usuario / pasajero
      if (esAprobado) {
        const { error } = await servicio.rpc(
          "aprobar_usuario_por_verificacion_sistema",
          {
            p_usuario_id: verificacion.usuario_id,
            p_verificacion_id: verificacion.id,
          },
        );
        if (error) throw error;
      } else if (esRechazado) {
        const { error } = await servicio.rpc(
          "rechazar_usuario_por_verificacion_sistema",
          {
            p_usuario_id: verificacion.usuario_id,
            p_verificacion_id: verificacion.id,
          },
        );
        if (error) throw error;
      } else if (esTerminal) {
        await servicio
          .from("verificaciones_identidad_didit")
          .update({ procesado_en: new Date().toISOString() })
          .eq("id", verificacion.id);
        console.log(
          `Verificación usuario Didit ${estadoDiditRaw} registrada para sesión ${sessionId}, usuario ${verificacion.usuario_id}`,
        );
      }
    } else if (verificacion.solicitud_id) {
      // Flujo de conductor
      if (esAprobado) {
        const { error } = await servicio.rpc(
          "aprobar_solicitud_conductor_sistema",
          {
            p_solicitud_id: verificacion.solicitud_id,
            p_verificacion_id: verificacion.id,
          },
        );
        if (error) throw error;
      } else if (esRechazado) {
        const { error } = await servicio.rpc(
          "rechazar_solicitud_por_verificacion_sistema",
          {
            p_solicitud_id: verificacion.solicitud_id,
            p_verificacion_id: verificacion.id,
          },
        );
        if (error) throw error;
      } else if (esTerminal) {
        await servicio
          .from("verificaciones_identidad_didit")
          .update({ procesado_en: new Date().toISOString() })
          .eq("id", verificacion.id);
        console.log(
          `Verificación conductor Didit ${estadoDiditRaw} registrada para sesión ${sessionId}, solicitud ${verificacion.solicitud_id}`,
        );
      }
    }
  } catch (error) {
    console.error(
      "Error aplicando decisión Didit",
      error instanceof Error ? error.message : error,
    );
    await servicio.from("verificaciones_identidad_didit").update({
      estado: "error",
    }).eq("id", verificacion.id);
    return json({ recibido: true, error_procesando: true }, 200);
  }

  return json({ recibido: true, estado: estadoInterno }, 200);
});
