// Edge Function: crea (o reutiliza) una sesión de Twilio Proxy para un
// traslado y devuelve el número virtual al que debe llamar quien lo pidió
// (PRD §4.12). El cliente abre ese número con un enlace `tel:` — esto no es
// un softphone, es un puente hacia el marcador nativo del teléfono.
//
// Variables de entorno requeridas (Supabase Dashboard → Edge Functions →
// Secrets):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PROXY_SERVICE_SID
//   (el Service de Proxy se crea una vez en Twilio Console, no aquí)
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// No se pudo probar contra una cuenta de Twilio real en este entorno (a
// diferencia de Stripe, no se compartieron credenciales de Twilio) — la
// lógica de decisión (logica.ts) sí está probada con `deno test` (11 casos).
// Antes de producción: crear el Proxy Service en Twilio Console, probar con
// dos números reales.
import { createClient } from "npm:@supabase/supabase-js@2";
import { validarTelefonos, determinarRolLlamador, debeReutilizarSesion } from "./logica.ts";

const CABECERAS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_PROXY_SERVICE_SID = Deno.env.get("TWILIO_PROXY_SERVICE_SID") ?? "";

function autenticacionTwilio(): string {
  return "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
}

async function llamarTwilio(ruta: string, cuerpo: Record<string, string>) {
  const respuesta = await fetch(`https://proxy.twilio.com/v1/Services/${TWILIO_PROXY_SERVICE_SID}${ruta}`, {
    method: "POST",
    headers: {
      Authorization: autenticacionTwilio(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(cuerpo)
  });
  if (!respuesta.ok) {
    throw new Error(`Twilio respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
  return await respuesta.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CABECERAS_CORS });
  }

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) {
    return new Response(JSON.stringify({ error: "Falta sesión" }), { status: 401, headers: CABECERAS_CORS });
  }

  const { traslado_id } = await req.json();
  if (!traslado_id) {
    return new Response(JSON.stringify({ error: "Falta traslado_id" }), { status: 400, headers: CABECERAS_CORS });
  }

  const clienteSesion = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: autorizacion } }
  });

  const { data: sesionAuth } = await clienteSesion.auth.getUser();
  if (!sesionAuth.user) {
    return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401, headers: CABECERAS_CORS });
  }

  // RLS ya filtra esto: si el traslado no es suyo (como usuario o como
  // conductor), esta consulta simplemente no devuelve la fila.
  const { data: traslado } = await clienteSesion
    .from("traslados")
    .select("id, estado, usuario_id, conductor_id")
    .eq("id", traslado_id)
    .maybeSingle();

  if (!traslado) {
    return new Response(JSON.stringify({ error: "Traslado no encontrado" }), { status: 404, headers: CABECERAS_CORS });
  }

  const clienteServicio = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: chatDisp } = await clienteServicio.rpc("chat_disponible", { p_estado: traslado.estado });
  if (!chatDisp) {
    return new Response(JSON.stringify({ error: "La comunicación para este traslado ya no está disponible" }), {
      status: 422,
      headers: CABECERAS_CORS
    });
  }

  const { data: usuario } = await clienteServicio.from("usuarios").select("id, telefono").eq("id", traslado.usuario_id).single();
  const { data: conductor } = traslado.conductor_id
    ? await clienteServicio.from("conductores").select("id, telefono").eq("id", traslado.conductor_id).single()
    : { data: null };

  const [{ data: miUsuario }, { data: miConductor }] = await Promise.all([
    clienteServicio.from("usuarios").select("id").eq("auth_user_id", sesionAuth.user.id).maybeSingle(),
    clienteServicio.from("conductores").select("id").eq("auth_user_id", sesionAuth.user.id).maybeSingle()
  ]);

  const rol = determinarRolLlamador(traslado.usuario_id, traslado.conductor_id, miUsuario?.id ?? null, miConductor?.id ?? null);
  if (!rol) {
    return new Response(JSON.stringify({ error: "No formas parte de este traslado" }), { status: 403, headers: CABECERAS_CORS });
  }

  const validacion = validarTelefonos(usuario?.telefono ?? null, conductor?.telefono ?? null);
  if (!validacion.valido) {
    return new Response(JSON.stringify({ error: validacion.motivo }), { status: 422, headers: CABECERAS_CORS });
  }

  const { data: sesionExistente } = await clienteServicio
    .from("sesiones_proxy_traslado")
    .select("numero_virtual, cerrada_en")
    .eq("traslado_id", traslado_id)
    .maybeSingle();

  let numeroVirtual: string;

  if (debeReutilizarSesion(sesionExistente)) {
    numeroVirtual = sesionExistente!.numero_virtual;
  } else {
    // Sesión nueva: crearla en Twilio con los dos participantes reales.
    const sesionTwilio = await llamarTwilio("/Sessions", {
      UniqueName: `traslado-${traslado_id}`
    });

    const participanteUsuario = await llamarTwilio(`/Sessions/${sesionTwilio.sid}/Participants`, {
      FriendlyName: "usuario",
      "ParticipantIdentifier.Identifier": usuario!.telefono!
    });

    const participanteConductor = await llamarTwilio(`/Sessions/${sesionTwilio.sid}/Participants`, {
      FriendlyName: "conductor",
      "ParticipantIdentifier.Identifier": conductor!.telefono!
    });

    numeroVirtual = participanteUsuario.proxy_identifier;

    await clienteServicio.from("sesiones_proxy_traslado").insert({
      traslado_id,
      twilio_session_sid: sesionTwilio.sid,
      numero_virtual: numeroVirtual,
      participante_usuario_sid: participanteUsuario.sid,
      participante_conductor_sid: participanteConductor.sid
    });
  }

  await clienteServicio.from("llamadas_enmascaradas").insert({
    traslado_id,
    iniciada_por: rol,
    numero_virtual: numeroVirtual
  });

  return new Response(JSON.stringify({ numeroProxy: numeroVirtual }), {
    status: 200,
    headers: { ...CABECERAS_CORS, "Content-Type": "application/json" }
  });
});
