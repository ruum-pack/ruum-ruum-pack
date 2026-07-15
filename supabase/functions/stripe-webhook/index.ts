/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Edge Function: recibe los webhooks de Stripe y actualiza pagos de usuarios
// en consecuencia (PRD §4.6).
//
// Variables de entorno requeridas en el proyecto de Supabase (Dashboard →
// Edge Functions → Secrets), nunca en el repo:
//   STRIPE_SECRET_KEY        — clave secreta de Stripe (sk_live_/sk_test_)
//   STRIPE_WEBHOOK_SECRET    — firma del endpoint (whsec_...), de Stripe Dashboard
//   SUPABASE_SERVICE_ROLE_KEY — para escribir sin pasar por RLS (es un webhook
//                               de un servidor de confianza, no de un usuario)
//
// No se pudo probar contra Stripe real ni un proyecto de Supabase desplegado en este entorno (no
// hay cuenta de Stripe ni acceso a un proyecto real desde aquí). Sí se probó este archivo completo
// (no solo logica.ts, que también está probada con `deno test`, ver logica.test.ts) corriendo de
// verdad con `deno serve` contra un mock local de PostgREST, recibiendo un evento firmado con el
// mismo esquema HMAC que usa Stripe — ver stripe-webhook/integration-test/.
// Antes de production: `stripe listen --forward-to <url>/stripe-webhook` para
// probar con eventos reales de Stripe en modo test.
import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  esEventoYaProcesado,
  extraerTrasladoId,
  esEventoManejado,
  estadoTrasladoSiguienteTrasPago
} from "./logica.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient()
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const SISTEMA_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

async function ejecutarSupabase<T>(
  operacion: PromiseLike<{ data: T; error: { message: string } | null }>,
  contexto: string
) {
  const { data, error } = await operacion;
  if (error) throw new Error(`${contexto}: ${error.message}`);
  return data;
}

async function registrarEventoWebhook(
  evento: string,
  datos: Record<string, unknown>,
  trasladoId: string | null = null
) {
  const { error } = await supabase.from("registro_auditoria").insert({
    traslado_id: trasladoId,
    evento,
    actor: "sistema",
    actor_id: SISTEMA_ACTOR_ID,
    datos
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  const firma = req.headers.get("stripe-signature");
  const cuerpo = await req.text();

  if (!firma) {
    return new Response("Falta stripe-signature", { status: 400 });
  }

  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(
      cuerpo,
      firma,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? ""
    );
  } catch (err) {
    console.error("Firma de webhook inválida:", err);
    return new Response("Firma inválida", { status: 400 });
  }

  if (!esEventoManejado(evento.type)) {
    // 200, no 4xx/5xx: que Stripe no reintente eventos que de verdad no nos interesan.
    return new Response("Evento no manejado, ignorado", { status: 200 });
  }

  try {
    switch (evento.type) {
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed": {
        const intent = evento.data.object as Stripe.PaymentIntent;
        const trasladoId = extraerTrasladoId(intent.metadata);
        if (!trasladoId) {
          console.warn("PaymentIntent sin traslado_id en metadata:", intent.id);
          break;
        }

        const pagoExistente = await ejecutarSupabase(
          supabase
            .from("pagos")
            .select("stripe_event_id, traslado_id")
            .eq("stripe_payment_intent_id", intent.id)
            .maybeSingle(),
          "No se pudo consultar el pago existente"
        );

        if (esEventoYaProcesado(evento.id, pagoExistente?.stripe_event_id)) break;

        const nuevoEstado = evento.type === "payment_intent.succeeded" ? "completado" : "fallido";
        await ejecutarSupabase(
          supabase
            .from("pagos")
            .update({ estado: nuevoEstado, stripe_event_id: evento.id })
            .eq("stripe_payment_intent_id", intent.id),
          "No se pudo actualizar el pago"
        );

        await registrarEventoWebhook(
          "registro_pago",
          {
            stripe_event_id: evento.id,
            stripe_payment_intent_id: intent.id,
            estado_pago: nuevoEstado,
            traslado_id: pagoExistente?.traslado_id ?? trasladoId
          },
          pagoExistente?.traslado_id ?? trasladoId
        );

        if (pagoExistente?.traslado_id) {
          const traslado = await ejecutarSupabase(
            supabase
              .from("traslados")
              .select("estado, tipo_pago")
              .eq("id", pagoExistente.traslado_id)
              .maybeSingle(),
            "No se pudo consultar el traslado del pago"
          );

          const siguienteEstado = estadoTrasladoSiguienteTrasPago(
            traslado?.estado,
            traslado?.tipo_pago,
            nuevoEstado
          );

          if (siguienteEstado) {
            await ejecutarSupabase(
              supabase.from("traslados").update({ estado: siguienteEstado }).eq("id", pagoExistente.traslado_id),
              "No se pudo actualizar el estado del traslado tras el pago"
            );
            await registrarEventoWebhook(
              "registro_pago",
              {
                stripe_event_id: evento.id,
                estado_anterior: traslado?.estado,
                estado_nuevo: siguienteEstado,
                tipo_pago: traslado?.tipo_pago
              },
              pagoExistente.traslado_id
            );
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Error procesando webhook de Stripe:", err);
    // 500 a propósito: Stripe reintenta automáticamente en este caso, que es
    // lo correcto si fue un error transitorio de la base de datos.
    return new Response("Error interno", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
