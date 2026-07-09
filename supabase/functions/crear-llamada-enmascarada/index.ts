/// <reference lib="deno.ns" />
/// <reference lib="dom" />

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

function respuestaJson(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CABECERAS_CORS, "Content-Type": "application/json" }
  });
}

function envRequerida(nombre: string) {
  const valor = Deno.env.get(nombre);
  if (!valor) throw new Error(`Falta ${nombre} en la Edge Function`);
  return valor;
}

function autenticacionTwilio(): string {
  return "Basic " + btoa(`${envRequerida("TWILIO_ACCOUNT_SID")}:${envRequerida("TWILIO_AUTH_TOKEN")}`);
}

async function llamarTwilio(ruta: string, cuerpo: Record<string, string>) {
  const respuesta = await fetch(`https://proxy.twilio.com/v1/Services/${envRequerida("TWILIO_PROXY_SERVICE_SID")}${ruta}`, {
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

  try {
    const autorizacion = req.headers.get("Authorization");
    if (!autorizacion) {
      return respuestaJson({ error: "Falta sesión" }, 401);
    }

    let payload: { traslado_id?: string };
    try {
      payload = (await req.json()) as { traslado_id?: string };
    } catch {
      return respuestaJson({ error: "JSON inválido" }, 400);
    }

    const { traslado_id } = payload;
    if (!traslado_id) {
      return respuestaJson({ error: "Falta traslado_id" }, 400);
    }

    const supabaseUrl = envRequerida("SUPABASE_URL");
    const anonKey = envRequerida("SUPABASE_ANON_KEY");
    const serviceRoleKey = envRequerida("SUPABASE_SERVICE_ROLE_KEY");

    const clienteSesion = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: autorizacion } }
    });

    const { data: sesionAuth, error: errorSesion } = await clienteSesion.auth.getUser();
    if (errorSesion || !sesionAuth.user) {
      return respuestaJson({ error: "Sesión inválida" }, 401);
    }

    // RLS ya filtra esto: si el traslado no es suyo (como usuario o como
    // conductor), esta consulta simplemente no devuelve la fila.
    const { data: traslado, error: errorTraslado } = await clienteSesion
      .from("traslados")
      .select("id, estado, usuario_id, conductor_id")
      .eq("id", traslado_id)
      .maybeSingle();
    if (errorTraslado) throw errorTraslado;

    if (!traslado) {
      return respuestaJson({ error: "Traslado no encontrado" }, 404);
    }

    const clienteServicio = createClient(supabaseUrl, serviceRoleKey);

    const { data: chatDisp, error: errorChat } = await clienteServicio.rpc("chat_disponible", { p_estado: traslado.estado });
    if (errorChat) throw errorChat;
    if (!chatDisp) {
      return respuestaJson({ error: "La comunicación para este traslado ya no está disponible" }, 422);
    }

    const { data: usuario, error: errorUsuario } = await clienteServicio.from("usuarios").select("id, telefono").eq("id", traslado.usuario_id).single();
    if (errorUsuario) throw errorUsuario;

    const { data: conductor, error: errorConductor } = traslado.conductor_id
      ? await clienteServicio.from("conductores").select("id, telefono").eq("id", traslado.conductor_id).single()
      : { data: null, error: null };
    if (errorConductor) throw errorConductor;

    const [{ data: miUsuario, error: errorMiUsuario }, { data: miConductor, error: errorMiConductor }] = await Promise.all([
      clienteServicio.from("usuarios").select("id").eq("auth_user_id", sesionAuth.user.id).maybeSingle(),
      clienteServicio.from("conductores").select("id").eq("auth_user_id", sesionAuth.user.id).maybeSingle()
    ]);
    if (errorMiUsuario) throw errorMiUsuario;
    if (errorMiConductor) throw errorMiConductor;

    const rol = determinarRolLlamador(traslado.usuario_id, traslado.conductor_id, miUsuario?.id ?? null, miConductor?.id ?? null);
    if (!rol) {
      return respuestaJson({ error: "No formas parte de este traslado" }, 403);
    }

    const validacion = validarTelefonos(usuario?.telefono ?? null, conductor?.telefono ?? null);
    if (!validacion.valido) {
      return respuestaJson({ error: validacion.motivo }, 422);
    }

    const { data: sesionExistente, error: errorSesionExistente } = await clienteServicio
      .from("sesiones_proxy_traslado")
      .select("numero_virtual, cerrada_en")
      .eq("traslado_id", traslado_id)
      .maybeSingle();
    if (errorSesionExistente) throw errorSesionExistente;

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

      const { error: errorInsertSesion } = await clienteServicio.from("sesiones_proxy_traslado").insert({
        traslado_id,
        twilio_session_sid: sesionTwilio.sid,
        numero_virtual: numeroVirtual,
        participante_usuario_sid: participanteUsuario.sid,
        participante_conductor_sid: participanteConductor.sid
      });
      if (errorInsertSesion) throw errorInsertSesion;
    }

    const { error: errorInsertLlamada } = await clienteServicio.from("llamadas_enmascaradas").insert({
      traslado_id,
      iniciada_por: rol,
      numero_virtual: numeroVirtual
    });
    if (errorInsertLlamada) throw errorInsertLlamada;

    return respuestaJson({ numeroProxy: numeroVirtual });
  } catch (error) {
    console.error("Error creando llamada enmascarada:", error);
    return respuestaJson({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
