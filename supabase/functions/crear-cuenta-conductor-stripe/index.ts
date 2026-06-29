// Edge Function: crea (si no existe) la cuenta de Stripe Connect Express
// del conductor y devuelve la URL de onboarding (PRD §4.6). Llamada desde
// app-conductor, pantalla de Ganancias.
//
// Variables de entorno requeridas: STRIPE_SECRET_KEY, SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, y RUUM_APP_CONDUCTOR_URL
// (para construir return_url/refresh_url del onboarding de Stripe).
//
// No se pudo probar contra una cuenta de Stripe real en este entorno.
import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-02-24.acacia"
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

  const clienteConductor = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: autorizacion } }
  });

  const { data: sesion } = await clienteConductor.auth.getUser();
  if (!sesion.user) {
    return new Response(JSON.stringify({ error: "Sesión inválida" }), { status: 401, headers: CABECERAS_CORS });
  }

  const { data: conductor } = await clienteConductor.from("conductores").select("id, nombre").maybeSingle();
  if (!conductor) {
    return new Response(JSON.stringify({ error: "No se encontró el registro de conductor" }), {
      status: 404,
      headers: CABECERAS_CORS
    });
  }

  const clienteServicio = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: cuentaExistente } = await clienteServicio
    .from("cuentas_conductor_stripe")
    .select("stripe_account_id")
    .eq("conductor_id", conductor.id)
    .maybeSingle();

  let stripeAccountId = cuentaExistente?.stripe_account_id;

  if (!stripeAccountId) {
    const cuenta = await stripe.accounts.create({
      type: "express",
      country: "MX",
      capabilities: { transfers: { requested: true } },
      business_type: "individual",
      metadata: { conductor_id: conductor.id }
    });
    stripeAccountId = cuenta.id;

    await clienteServicio.from("cuentas_conductor_stripe").insert({
      conductor_id: conductor.id,
      stripe_account_id: stripeAccountId
    });
  }

  const urlBase = Deno.env.get("RUUM_APP_CONDUCTOR_URL") ?? "https://www.concer.ruumruum-moviliax.online";
  const enlace = await stripe.accountLinks.create({
    account: stripeAccountId,
    type: "account_onboarding",
    refresh_url: `${urlBase}/ganancias`,
    return_url: `${urlBase}/ganancias`
  });

  return new Response(JSON.stringify({ url: enlace.url }), {
    status: 200,
    headers: { ...CABECERAS_CORS, "Content-Type": "application/json" }
  });
});
