// Edge Function: crea un PaymentIntent de Stripe para el cobro de un

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@2";

const CABECERAS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function respuestaJson(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CABECERAS_CORS, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...CABECERAS_CORS,
        "Access-Control-Allow-Headers": req.headers.get("Access-Control-Request-Headers") ?? CABECERAS_CORS["Access-Control-Allow-Headers"]
      }
    });
  }

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) {
    return respuestaJson({ error: "Falta sesión" }, 401);
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    return respuestaJson({ error: "Stripe no está configurado en la Edge Function" }, 500);
  }

  if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return respuestaJson({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en la Edge Function" }, 500);
  }

  // Cliente "como el usuario" (respeta RLS) — confirma que la sesión es real
  // y que el traslado de verdad le pertenece, antes de crear ningún cobro.
  const clienteUsuario = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: autorizacion } }
  });

  const { traslado_id } = (await req.json()) as { traslado_id?: string | number };
  if (!traslado_id) {
    return respuestaJson({ error: "Falta traslado_id" }, 400);
  }

  const { data: traslado, error: errorTraslado } = await clienteUsuario
    .from("traslados")
    .select("id, precio_cotizado, tipo_pago")
    .eq("id", traslado_id)
    .single();

  if (errorTraslado || !traslado) {
    // RLS ya filtró esto: si no es tuyo, no existe para esta consulta.
    return respuestaJson({ error: "Traslado no encontrado" }, 404);
  }

  if (!traslado.precio_cotizado || traslado.precio_cotizado <= 0) {
    return respuestaJson({ error: "El traslado no tiene una tarifa cotizada válida" }, 422);
  }

  if (traslado.tipo_pago !== "anticipado") {
    return respuestaJson({ error: "El cobro anticipado solo aplica a traslados con pago anticipado" }, 422);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient()
  });

  const clienteServicio = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: pagoPendiente, error: errorPagoPendiente } = await clienteServicio
    .from("pagos")
    .select("stripe_payment_intent_id")
    .eq("traslado_id", traslado.id)
    .eq("estado", "pendiente")
    .not("stripe_payment_intent_id", "is", null)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorPagoPendiente) {
    return respuestaJson({ error: errorPagoPendiente.message }, 500);
  }

  if (pagoPendiente?.stripe_payment_intent_id) {
    const intentExistente = await stripe.paymentIntents.retrieve(pagoPendiente.stripe_payment_intent_id);
    return respuestaJson({ clientSecret: intentExistente.client_secret });
  }

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(traslado.precio_cotizado * 100), // Stripe usa centavos
    currency: "mxn",
    metadata: { traslado_id: traslado.id },
    automatic_payment_methods: { enabled: true }
  });

  // service_role: pagos no tiene política de INSERT para usuarios (por
  // diseño, ver 0007_pagos.sql) — el cobro se registra desde un servidor de
  // confianza, no desde el cliente.
  const { error: errorPago } = await clienteServicio.from("pagos").insert({
    traslado_id: traslado.id,
    monto: traslado.precio_cotizado,
    momento: traslado.tipo_pago,
    metodo: "tarjeta",
    estado: "pendiente",
    stripe_payment_intent_id: intent.id
  });

  if (errorPago) {
    return respuestaJson({ error: errorPago.message }, 500);
  }

  return respuestaJson({ clientSecret: intent.client_secret });
});
