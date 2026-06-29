// Edge Function: crea un PaymentIntent de Stripe para el cobro de un

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@2";


const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient()
});

const CABECERAS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CABECERAS_CORS });
  }

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) {
    return new Response(JSON.stringify({ error: "Falta sesión" }), { status: 401, headers: CABECERAS_CORS });
  }

  // Cliente "como el usuario" (respeta RLS) — confirma que la sesión es real
  // y que el traslado de verdad le pertenece, antes de crear ningún cobro.
  const clienteUsuario = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: autorizacion } }
  });

  const { traslado_id } = (await req.json()) as { traslado_id?: string | number };
  if (!traslado_id) {
    return new Response(JSON.stringify({ error: "Falta traslado_id" }), { status: 400, headers: CABECERAS_CORS });
  }

  const { data: traslado, error: errorTraslado } = await clienteUsuario
    .from("traslados")
    .select("id, precio_cotizado, tipo_pago")
    .eq("id", traslado_id)
    .single();

  if (errorTraslado || !traslado) {
    // RLS ya filtró esto: si no es tuyo, no existe para esta consulta.
    return new Response(JSON.stringify({ error: "Traslado no encontrado" }), { status: 404, headers: CABECERAS_CORS });
  }

  if (!traslado.precio_cotizado || traslado.precio_cotizado <= 0) {
    return new Response(JSON.stringify({ error: "El traslado no tiene una tarifa cotizada válida" }), {
      status: 422,
      headers: CABECERAS_CORS
    });
  }

  if (traslado.tipo_pago !== "anticipado") {
    return new Response(JSON.stringify({ error: "El cobro anticipado solo aplica a traslados con pago anticipado" }), {
      status: 422,
      headers: CABECERAS_CORS
    });
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
  const clienteServicio = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  await clienteServicio.from("pagos").insert({
    traslado_id: traslado.id,
    monto: traslado.precio_cotizado,
    momento: traslado.tipo_pago,
    metodo: "tarjeta",
    estado: "pendiente",
    stripe_payment_intent_id: intent.id
  });

  return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
    status: 200,
    headers: { ...CABECERAS_CORS, "Content-Type": "application/json" }
  });
});
