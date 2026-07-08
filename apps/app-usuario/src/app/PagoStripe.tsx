"use client";

import { useEffect, useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import { crearClienteNavegador } from "../lib/supabase-browser";

const clavePublica = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function tieneStripePublicoConfigurado(): boolean {
  return Boolean(clavePublica);
}

export interface PagoStripeProps {
  trasladoId: string;
  onPagado: () => void;
}

async function crearPaymentIntent(trasladoId: string): Promise<string> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no está configurado para iniciar el cobro.");
  }

  const cliente = crearClienteNavegador();
  const { data: sesion, error: errorSesion } = await cliente.auth.getSession();
  if (errorSesion) throw errorSesion;

  const token = sesion.session?.access_token;
  if (!token) {
    throw new Error("Tu sesión expiró. Inicia sesión de nuevo para pagar.");
  }

  const respuesta = await fetch(`${supabaseUrl}/functions/v1/crear-payment-intent`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ traslado_id: trasladoId })
  });

  const texto = await respuesta.text();
  let data: { clientSecret?: string; error?: string } | null = null;
  if (texto) {
    try {
      data = JSON.parse(texto) as { clientSecret?: string; error?: string };
    } catch {
      throw new Error(`La función de pago respondió con un formato inválido (${respuesta.status}).`);
    }
  }

  if (!respuesta.ok) {
    throw new Error(data?.error ?? `No pudimos iniciar el cobro (${respuesta.status}).`);
  }

  if (!data?.clientSecret) {
    throw new Error("La función de pago no devolvió clientSecret.");
  }

  return data.clientSecret;
}

/**
 * PRD §4.6 — cobro anticipado real. Solo se monta cuando hay sesión real,
 * traslado persistido y NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY está configurada
 * (ver .env.local.example).
 *
 * No se pudo probar contra una cuenta de Stripe real en este entorno — la
 * Edge Function que esto invoca (crear-payment-intent) está validada con
 * `deno check`, no con un pago real procesado.
 */
export function PagoStripe({ trasladoId, onPagado }: PagoStripeProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeModule, setStripeModule] = useState<{ Elements: any; PaymentElement: any; useStripe: any; useElements: any; stripePromise: any } | null>(null);

  useEffect(() => {
    async function iniciar() {
      try {
        if (!clavePublica) {
          setError("Stripe no está configurado — el cobro real no está disponible en este entorno.");
          return;
        }

        const mod = await import("@stripe/react-stripe-js");
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripePromise = await loadStripe(clavePublica);
        setStripeModule({
          Elements: mod.Elements,
          PaymentElement: mod.PaymentElement,
          useStripe: mod.useStripe,
          useElements: mod.useElements,
          stripePromise
        });

        const clientSecret = await crearPaymentIntent(trasladoId);
        setClientSecret(clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos iniciar el cobro.");
      }
    }

    iniciar();
  }, [trasladoId]);

  if (error) {
    return (
      <div role="status" aria-live="polite" aria-atomic="true">
        <Aviso tono="peligro">{error}</Aviso>
      </div>
    );
  }

  if (!clientSecret || !stripeModule) {
    return <p className="font-body text-sm text-ink/50">Preparando el cobro…</p>;
  }

  const { Elements, PaymentElement, useStripe, useElements, stripePromise } = stripeModule;

  return (
    <Elements stripe={stripePromise as any} options={{ clientSecret }}>
      <FormularioPago onPagado={onPagado} PaymentElement={PaymentElement} useStripe={useStripe} useElements={useElements} />
    </Elements>
  );
}

function FormularioPago({ onPagado, PaymentElement, useStripe, useElements }: { onPagado: () => void; PaymentElement: any; useStripe: any; useElements: any }) {
  const stripe = useStripe();
  const elements = useElements();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setEnviando(true);
    setError(null);

    const { error: errorPago } = await stripe.confirmPayment({
      elements,
      redirect: "if_required"
    });

    if (errorPago) {
      setError(errorPago.message ?? "No pudimos procesar el pago.");
      setEnviando(false);
      return;
    }

    onPagado();
  }

  return (
    <form onSubmit={confirmar} className="grid gap-4">
      <PaymentElement />
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <Button type="submit" disabled={!stripe || enviando}>
        {enviando ? "Procesando…" : "Pagar y confirmar traslado"}
      </Button>
    </form>
  );
}
