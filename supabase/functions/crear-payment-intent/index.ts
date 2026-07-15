/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// Edge Function: crea un PaymentIntent de Stripe para el cobro de un

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@2";
import { montoAutorizadoParaCobro, validarRangoMontoCobro } from "./logica.ts";

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

  const { data: sesion, error: errorSesion } = await clienteUsuario.auth.getUser();
  if (errorSesion || !sesion.user) {
    return respuestaJson({ error: "Sesión inválida" }, 401);
  }

  const { data: usuarioActual, error: errorUsuarioActual } = await clienteUsuario
    .from("usuarios")
    .select("id, tipo_cuenta, rol, empresa_id")
    .eq("auth_user_id", sesion.user.id)
    .single();

  if (errorUsuarioActual || !usuarioActual) {
    return respuestaJson({ error: "Usuario no encontrado" }, 404);
  }

  let payload: { traslado_id?: string | number };
  try {
    payload = (await req.json()) as { traslado_id?: string | number };
  } catch {
    return respuestaJson({ error: "JSON inválido" }, 400);
  }

  const { traslado_id } = payload;
  if (!traslado_id) {
    return respuestaJson({ error: "Falta traslado_id" }, 400);
  }

  const { data: traslado, error: errorTraslado } = await clienteUsuario
    .from("traslados")
    .select("id, usuario_id, precio_cotizado, precio_final, tipo_pago, estado, cotizacion_expira_en")
    .eq("id", traslado_id)
    .single();

  if (errorTraslado || !traslado) {
    // RLS ya filtró esto: si no es tuyo, no existe para esta consulta.
    return respuestaJson({ error: "Traslado no encontrado" }, 404);
  }

  const { data: solicitante, error: errorSolicitante } = await clienteUsuario
    .from("usuarios")
    .select("id, tipo_cuenta, rol, empresa_id")
    .eq("id", traslado.usuario_id)
    .single();

  if (errorSolicitante || !solicitante) {
    return respuestaJson({ error: "No se pudo validar la cuenta que solicitó el traslado" }, 403);
  }

  const esTrasladoEmpresa =
    solicitante.tipo_cuenta === "empresa" ||
    (solicitante.empresa_id !== null && solicitante.empresa_id === usuarioActual.empresa_id);

  if (esTrasladoEmpresa && usuarioActual.rol !== "titular_empresa") {
    return respuestaJson(
      { error: "Necesitas autorización del titular de la empresa para iniciar este pago." },
      403
    );
  }

  // PRD §4.6 — "El precio puede ser dinámico": si ya hay un precio_final
  // (ajustado al cierre), ese es el monto a cobrar; si no, se usa la
  // cotización original (mismo criterio que pasaporte_digital/panel-admin).
  const montoACobrar = montoAutorizadoParaCobro(traslado);
  if (montoACobrar === null) {
    return respuestaJson({ error: "El traslado todavía no cuenta con una cotización válida." }, 422);
  }
  const validacionMonto = validarRangoMontoCobro(montoACobrar);
  if (!validacionMonto.valido) {
    return respuestaJson({ error: validacionMonto.error }, 422);
  }
  if (traslado.cotizacion_expira_en && new Date(traslado.cotizacion_expira_en).getTime() <= Date.now()) {
    return respuestaJson({ error: "La cotización ha vencido. Solicita una actualización antes de pagar." }, 422);
  }

  // Defensa adicional sobre el precio autorizado. presupuesto_usuario nunca
  // participa en este cálculo ni se selecciona en esta función.

  // El cobro anticipado se dispara al crear la solicitud (cualquier estado,
  // como hasta ahora). El cobro al cierre solo tiene sentido una vez que el
  // traslado de verdad está esperando ese pago. El conductor no resuelve
  // pagos: al cierre, el cobro puede iniciarse en entrega_confirmada
  // (usuario/admin) y se mantiene compatibilidad con pago_pendiente para
  // traslados históricos que ya hayan llegado a ese estado.
  const esCobroAnticipadoValido =
    traslado.tipo_pago === "anticipado" && traslado.estado === "cotizacion_aceptada";
  const esCobroAlCierreValido =
    traslado.tipo_pago === "al_cierre" && ["entrega_confirmada", "pago_pendiente"].includes(traslado.estado);

  if (!esCobroAnticipadoValido && !esCobroAlCierreValido) {
    return respuestaJson(
      {
        error:
          traslado.tipo_pago === "al_cierre"
            ? "El pago al cierre solo puede iniciarse cuando la entrega está confirmada"
            : traslado.tipo_pago === "anticipado"
              ? "Acepta la cotización antes de iniciar el pago anticipado"
              : "Este traslado no tiene un cobro pendiente que iniciar"
      },
      422
    );
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
    .order("registrado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errorPagoPendiente) {
    return respuestaJson({ error: errorPagoPendiente.message }, 500);
  }

  if (pagoPendiente?.stripe_payment_intent_id) {
    try {
      const intentExistente = await stripe.paymentIntents.retrieve(pagoPendiente.stripe_payment_intent_id);
      return respuestaJson({ clientSecret: intentExistente.client_secret });
    } catch (error) {
      console.error("Error recuperando PaymentIntent:", error);
      return respuestaJson({ error: "No se pudo recuperar el intento de pago" }, 502);
    }
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: Math.round(montoACobrar * 100), // Stripe usa centavos
      currency: "mxn",
      metadata: { traslado_id: traslado.id },
      automatic_payment_methods: { enabled: true }
    });
  } catch (error) {
    console.error("Error creando PaymentIntent:", error);
    return respuestaJson({ error: "No se pudo crear el intento de pago" }, 502);
  }

  // service_role: pagos no tiene política de INSERT para usuarios (por
  // diseño, ver 0007_pagos.sql) — el cobro se registra desde un servidor de
  // confianza, no desde el cliente.
  const { error: errorPago } = await clienteServicio.from("pagos").insert({
    traslado_id: traslado.id,
    monto: montoACobrar,
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
