/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Crea una sesión de verificación de identidad en Didit (OCR + prueba de
// vida + coincidencia facial) para una solicitud de conductor que ya está
// en revisión, y devuelve la URL para que el conductor la complete.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Inicia sesión para continuar." }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const diditApiKey = Deno.env.get("DIDIT_API_KEY") ?? "";
  const diditWorkflowId = Deno.env.get("DIDIT_WORKFLOW_ID") ?? "";
  const callbackUrl = Deno.env.get("DIDIT_CALLBACK_URL") ?? "";
  if (!url || !anon || !serviceKey || !diditApiKey || !diditWorkflowId) {
    return json({ error: "El servicio de verificación no está configurado." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const solicitudId = String(body.solicitud_id ?? "");
  if (!UUID.test(solicitudId)) return json({ error: "solicitud_id inválido." }, 400);

  const usuario = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const servicio = createClient(url, serviceKey);

  const { data: sesion, error: errorSesion } = await usuario.auth.getUser();
  if (errorSesion || !sesion.user) return json({ error: "La sesión no es válida." }, 401);

  const { data: solicitud, error: errorSolicitud } = await usuario
    .from("solicitudes_conductor")
    .select("id,estado")
    .eq("id", solicitudId)
    .eq("auth_user_id", sesion.user.id)
    .maybeSingle();
  if (errorSolicitud) return json({ error: "No fue posible validar la solicitud." }, 500);
  if (!solicitud) return json({ error: "Solicitud no encontrada." }, 404);
  if (solicitud.estado !== "en_revision") {
    return json({ error: "La solicitud debe estar en revisión para iniciar la verificación automática." }, 409);
  }

  // Si existen sesiones pendientes previas para la misma solicitud, las marcamos como expiradas
  await servicio
    .from("verificaciones_identidad_didit")
    .update({ estado: "expirado" })
    .eq("solicitud_id", solicitudId)
    .in("estado", ["pendiente", "en_revision"]);

  const respuestaDidit = await fetch("https://verification.didit.me/v2/session/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": diditApiKey,
      "Authorization": `Bearer ${diditApiKey}`
    },
    body: JSON.stringify({
      workflow_id: diditWorkflowId,
      vendor_data: solicitudId,
      ...(callbackUrl ? { callback: callbackUrl } : {}),
    }),
  });
  if (!respuestaDidit.ok) {
    const detalle = await respuestaDidit.text().catch(() => "");
    console.error("Error creando sesión Didit", respuestaDidit.status, detalle);
    return json({ error: "No fue posible iniciar la verificación de identidad." }, 502);
  }

  const datosDidit = (await respuestaDidit.json()) as {
    session_id?: string;
    sessionId?: string;
    id?: string;
    url?: string;
    session_url?: string;
    session_token?: string;
  };

  const sessionId = datosDidit.session_id ?? datosDidit.sessionId ?? datosDidit.id ?? datosDidit.session_token ?? "";
  const verificationUrl = datosDidit.url ?? datosDidit.session_url ?? "";

  if (!sessionId || !verificationUrl) {
    console.error("Respuesta incompleta de Didit", datosDidit);
    return json({ error: "Respuesta incompleta del proveedor de identidad." }, 502);
  }

  const { error: errorInsert } = await servicio.from("verificaciones_identidad_didit").insert({
    solicitud_id: solicitudId,
    session_id: sessionId,
    workflow_id: diditWorkflowId,
    estado: "pendiente",
  });
  if (errorInsert) {
    console.error("Error registrando verificación Didit", errorInsert.message);
    return json({ error: "No fue posible registrar la verificación." }, 500);
  }

  return json({ session_id: sessionId, url: verificationUrl }, 201);
});
