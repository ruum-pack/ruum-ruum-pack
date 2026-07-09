/// <reference lib="deno.ns" />
/// <reference lib="dom" />

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CABECERAS_CORS });
  }

  try {
    const autorizacion = req.headers.get("Authorization");
    if (!autorizacion) {
      return respuestaJson({ error: "Falta sesión" }, 401);
    }

    const supabaseUrl = envRequerida("SUPABASE_URL");
    const anonKey = envRequerida("SUPABASE_ANON_KEY");
    const serviceRoleKey = envRequerida("SUPABASE_SERVICE_ROLE_KEY");
    const stripe = new Stripe(envRequerida("STRIPE_SECRET_KEY"), {
      apiVersion: "2025-02-24.acacia",
      httpClient: Stripe.createFetchHttpClient()
    });

    const clienteConductor = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: autorizacion } }
    });

    const { data: sesion, error: errorSesion } = await clienteConductor.auth.getUser();
    if (errorSesion || !sesion.user) {
      return respuestaJson({ error: "Sesión inválida" }, 401);
    }

    const { data: conductor, error: errorConductor } = await clienteConductor.from("conductores").select("id, nombre").maybeSingle();
    if (errorConductor) throw errorConductor;
    if (!conductor) {
      return respuestaJson({ error: "No se encontró el registro de conductor" }, 404);
    }

    const clienteServicio = createClient(supabaseUrl, serviceRoleKey);

    const { data: cuentaExistente, error: errorCuentaExistente } = await clienteServicio
      .from("cuentas_conductor_stripe")
      .select("stripe_account_id")
      .eq("conductor_id", conductor.id)
      .maybeSingle();
    if (errorCuentaExistente) throw errorCuentaExistente;

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

      const { error: errorInsertCuenta } = await clienteServicio.from("cuentas_conductor_stripe").insert({
        conductor_id: conductor.id,
        stripe_account_id: stripeAccountId
      });
      if (errorInsertCuenta) throw errorInsertCuenta;
    }

    const urlBase = Deno.env.get("RUUM_APP_CONDUCTOR_URL") ?? "https://www.concer.ruumruum-moviliax.online";
    const enlace = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: "account_onboarding",
      refresh_url: `${urlBase}/ganancias`,
      return_url: `${urlBase}/ganancias`
    });

    return respuestaJson({ url: enlace.url });
  } catch (error) {
    console.error("Error creando cuenta Stripe Connect:", error);
    return respuestaJson({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
