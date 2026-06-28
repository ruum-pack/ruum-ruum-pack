// Edge Function: recibe los webhooks de Stripe y actualiza pagos,
// cuentas_conductor_stripe y payouts_conductor en consecuencia (PRD §4.6).
//
// Variables de entorno requeridas en el proyecto de Supabase (Dashboard →
// Edge Functions → Secrets), nunca en el repo:
//   STRIPE_SECRET_KEY        — clave secreta de Stripe (sk_live_/sk_test_)
//   STRIPE_WEBHOOK_SECRET    — firma del endpoint (whsec_...), de Stripe Dashboard
//   SUPABASE_SERVICE_ROLE_KEY — para escribir sin pasar por RLS (es un webhook
//                               de un servidor de confianza, no de un usuario)
//
// No se pudo probar contra un webhook real de Stripe en este entorno (no hay
// cuenta de Stripe ni acceso a internet hacia su API desde aquí) — la lógica
// de decisión (logica.ts) sí está probada con `deno test` (ver logica.test.ts).
// Antes de production: `stripe listen --forward-to <url>/stripe-webhook` para
// probar con eventos reales de Stripe en modo test.
import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  esEventoYaProcesado,
  extraerTrasladoId,
  cuentaConductorEstaActiva,
  esEventoManejado
} from "./logica.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-02-24.acacia"
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

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

        const { data: pagoExistente } = await supabase
          .from("pagos")
          .select("stripe_event_id")
          .eq("stripe_payment_intent_id", intent.id)
          .maybeSingle();

        if (esEventoYaProcesado(evento.id, pagoExistente?.stripe_event_id)) break;

        const nuevoEstado = evento.type === "payment_intent.succeeded" ? "completado" : "fallido";
        await supabase
          .from("pagos")
          .update({ estado: nuevoEstado, stripe_event_id: evento.id })
          .eq("stripe_payment_intent_id", intent.id);
        break;
      }

      case "account.updated": {
        const cuenta = evento.data.object as Stripe.Account;
        const activa = cuentaConductorEstaActiva(cuenta.charges_enabled, cuenta.details_submitted);
        await supabase
          .from("cuentas_conductor_stripe")
          .update({ estado: activa ? "activa" : "pendiente_onboarding" })
          .eq("stripe_account_id", cuenta.id);
        break;
      }

      case "transfer.created":
      case "transfer.reversed": {
        // Nota importante: esto marca que la PLATAFORMA movió el dinero al
        // balance de Stripe del conductor (Transfer) — no que el banco del
        // conductor ya lo recibió. Esa confirmación final es un objeto
        // Payout distinto, en el lado de la cuenta conectada
        // (payout.paid/payout.failed), con su propio endpoint de webhook
        // "Connect" — no cubierto en este corte (ver README).
        const transferencia = evento.data.object as Stripe.Transfer;
        await supabase
          .from("payouts_conductor")
          .update({
            estado: evento.type === "transfer.created" ? "procesado" : "fallido",
            procesado_en: new Date().toISOString()
          })
          .eq("stripe_transfer_id", transferencia.id);
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
