"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button, Aviso } from "@ruum/ui";
import { crearClienteNavegador } from "../lib/supabase-browser";

const clavePublica = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = clavePublica ? loadStripe(clavePublica) : null;

export interface PagoStripeProps {
  trasladoId: string;
  onPagado: () => void;
}

/**
 * PRD §4.6 — cobro anticipado real. Solo se monta cuando hay sesión real y
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY está configurada (ver .env.local.example);
 * sin eso, traslados/nuevo/page.tsx no llega a renderizar este componente y
 * sigue el flujo de éxito inmediato que ya existía.
 *
 * No se pudo probar contra una cuenta de Stripe real en este entorno — la
 * Edge Function que esto invoca (crear-payment-intent) está validada con
 * `deno check`, no con un pago real procesado.
 */
export function PagoStripe({ trasladoId, onPagado }: PagoStripeProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function iniciar() {
      try {
        const cliente = crearClienteNavegador();
        const { data, error: errorFuncion } = await cliente.functions.invoke("crear-payment-intent", {
          body: { traslado_id: trasladoId }
        });
        if (errorFuncion) throw errorFuncion;
        setClientSecret(data.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos iniciar el cobro.");
      }
    }
    iniciar();
  }, [trasladoId]);

  if (!stripePromise) {
    return <Aviso tono="info">Stripe no está configurado — el cobro real no está disponible en este entorno.</Aviso>;
  }

  if (error) {
    return <Aviso tono="peligro">{error}</Aviso>;
  }

  if (!clientSecret) {
    return <p className="font-body text-sm text-ink/50">Preparando el cobro…</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <FormularioPago onPagado={onPagado} />
    </Elements>
  );
}

function FormularioPago({ onPagado }: { onPagado: () => void }) {
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
