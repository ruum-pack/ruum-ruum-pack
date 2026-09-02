/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Crea una sesión de verificación de identidad en Didit (OCR + prueba de
// vida + coincidencia facial) tanto para conductores (solicitud_id) como
// para usuarios/pasajeros (usuario_id).

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  construirPayloadSesionDidit,
  detalleRespuestaDidit,
  esUrlHospedadaDiditValida,
  obtenerRetratoDidit,
  urlSesionDidit,
} from "../_shared/didit-session.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function esCallbackValido(valor: string): boolean {
  try {
    const url = new URL(valor);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return json({ error: "Inicia sesión para continuar." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const diditApiKey = Deno.env.get("DIDIT_API_KEY") ?? "";
  const diditWorkflowId = Deno.env.get("DIDIT_WORKFLOW_ID") ?? "";
  const callbackUrl = Deno.env.get("DIDIT_CALLBACK_URL") ?? "";
  if (!url || !anon || !serviceKey || !diditApiKey || !diditWorkflowId) {
    return json(
      { error: "El servicio de verificación no está configurado." },
      500,
    );
  }
  if (!UUID.test(diditWorkflowId)) {
    return json({ error: "DIDIT_WORKFLOW_ID no tiene un UUID válido." }, 500);
  }
  if (callbackUrl && !esCallbackValido(callbackUrl)) {
    return json({ error: "DIDIT_CALLBACK_URL no es una URL válida." }, 500);
  }

  let body: Record<string, unknown>;
  try {
    const texto = await req.text();
    const parseado = texto.trim() ? JSON.parse(texto) : {};
    if (
      typeof parseado !== "object" || parseado === null ||
      Array.isArray(parseado)
    ) {
      return json({ error: "El cuerpo debe ser un objeto JSON." }, 400);
    }
    body = parseado as Record<string, unknown>;
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const usuario = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  });
  const servicio = createClient(url, serviceKey);

  const { data: sesion, error: errorSesion } = await usuario.auth.getUser();
  if (errorSesion || !sesion.user) {
    return json({ error: "La sesión no es válida." }, 401);
  }

  const solicitudId = body.solicitud_id ? String(body.solicitud_id) : "";
  const esFlujoUsuario = !solicitudId || body.tipo === "usuario";

  let vendorData = "";
  let solicitudValidaId: string | null = null;
  let usuarioValidoId: string | null = null;
  let fotoPerfilUrl: string | null = null;

  if (esFlujoUsuario) {
    // Verificación para cuenta de usuario/pasajero
    const { data: perfilUsuario, error: errorPerfil } = await usuario
      .from("usuarios")
      .select("id, estado_verificacion, foto_url")
      .eq("auth_user_id", sesion.user.id)
      .maybeSingle();

    if (errorPerfil) {
      return json({ error: "No fue posible consultar tu perfil." }, 500);
    }
    if (!perfilUsuario) {
      return json({ error: "Perfil de usuario no encontrado." }, 404);
    }

    usuarioValidoId = perfilUsuario.id;
    fotoPerfilUrl = perfilUsuario.foto_url;
    vendorData = `usuario:${perfilUsuario.id}`;

    // Expirar verificaciones pendientes previas de este usuario
    await servicio
      .from("verificaciones_identidad_didit")
      .update({ estado: "expirado" })
      .eq("usuario_id", perfilUsuario.id)
      .in("estado", ["pendiente", "en_revision"]);
  } else {
    // Verificación para conductor con solicitud
    if (!UUID.test(solicitudId)) {
      return json({ error: "solicitud_id inválido." }, 400);
    }

    const { data: solicitud, error: errorSolicitud } = await usuario
      .from("solicitudes_conductor")
      .select("id,estado")
      .eq("id", solicitudId)
      .eq("auth_user_id", sesion.user.id)
      .maybeSingle();

    if (errorSolicitud) {
      return json({ error: "No fue posible validar la solicitud." }, 500);
    }
    if (!solicitud) return json({ error: "Solicitud no encontrada." }, 404);
    if (solicitud.estado !== "en_revision") {
      return json({
        error:
          "La solicitud debe estar en revisión para iniciar la verificación automática.",
      }, 409);
    }

    solicitudValidaId = solicitud.id;
    vendorData = solicitud.id;

    // Expirar sesiones pendientes previas para la misma solicitud
    await servicio
      .from("verificaciones_identidad_didit")
      .update({ estado: "expirado" })
      .eq("solicitud_id", solicitud.id)
      .in("estado", ["pendiente", "en_revision"]);
  }

  let portraitImage: string | null = null;
  if (esFlujoUsuario) {
    portraitImage = await obtenerRetratoDidit(
      fotoPerfilUrl,
      url,
      sesion.user.id,
    );
  }

  const payloadDidit = construirPayloadSesionDidit({
    workflowId: diditWorkflowId,
    vendorData,
    callbackUrl,
    portraitImage,
  });

  let respuestaDidit: Response;
  try {
    respuestaDidit = await fetch(urlSesionDidit(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": diditApiKey,
      },
      body: JSON.stringify(payloadDidit),
    });
  } catch (error) {
    console.error(
      "Error de red creando sesión Didit",
      error instanceof Error ? error.message : error,
    );
    return json({
      error:
        "No fue posible conectar con el servicio de Didit. Intenta nuevamente.",
    }, 502);
  }

  if (!respuestaDidit.ok) {
    const detalle = await respuestaDidit.text().catch(() => "");
    const detalleLegible = detalleRespuestaDidit(detalle);
    console.error(
      "Error creando sesión Didit",
      respuestaDidit.status,
      detalleLegible,
    );
    if (
      respuestaDidit.status === 400 &&
      /portrait[_ -]?image|portrait image|face match|reference image/i.test(
        detalleLegible,
      )
    ) {
      return json({
        error:
          "Este flujo de Didit requiere una fotografía de perfil para comparar tu rostro. Sube una foto clara y vuelve a intentarlo.",
      }, 422);
    }
    return json({
      error: `Error al conectar con Didit (HTTP ${respuestaDidit.status}): ${
        detalleLegible ||
        "Verifica que DIDIT_API_KEY y DIDIT_WORKFLOW_ID sean válidos."
      }`,
    }, 502);
  }

  let datosDidit: {
    session_id?: string;
    sessionId?: string;
    id?: string;
    url?: string;
    verification_url?: string;
    session_url?: string;
  };
  try {
    const parseado = await respuestaDidit.json() as unknown;
    if (
      typeof parseado !== "object" || parseado === null ||
      Array.isArray(parseado)
    ) {
      return json(
        { error: "Respuesta inválida del proveedor de identidad." },
        502,
      );
    }
    datosDidit = parseado as typeof datosDidit;
  } catch {
    return json(
      { error: "Respuesta inválida del proveedor de identidad." },
      502,
    );
  }

  const sessionId = datosDidit.session_id ?? datosDidit.sessionId ??
    datosDidit.id ?? "";
  const verificationUrl = datosDidit.url ?? datosDidit.verification_url ??
    datosDidit.session_url ?? "";

  if (!sessionId || !esUrlHospedadaDiditValida(verificationUrl)) {
    console.error("Respuesta incompleta de Didit", datosDidit);
    return json(
      { error: "Respuesta incompleta del proveedor de identidad." },
      502,
    );
  }

  const { error: errorInsert } = await servicio.from(
    "verificaciones_identidad_didit",
  ).upsert({
    solicitud_id: solicitudValidaId,
    usuario_id: usuarioValidoId,
    session_id: sessionId,
    workflow_id: diditWorkflowId,
    estado: "pendiente",
    decision: null,
    procesado_en: null,
  }, { onConflict: "session_id" });

  if (errorInsert) {
    console.error("Error registrando verificación Didit", errorInsert.message);
    return json({ error: "No fue posible registrar la verificación." }, 500);
  }

  return json({ session_id: sessionId, url: verificationUrl }, 201);
});
