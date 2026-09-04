"use client";

import { useEffect, useState } from "react";
import { Button, Aviso } from "@ruum/ui";
import { crearClienteNavegador } from "../lib/supabase-browser";

const clavePublica = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/* Configuración de apariencia institucional oscura para Stripe Elements */
const aparienciaStripe = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#FFC400",
    colorBackground: "#0A1220",
    colorText: "#F8F8F5",
    colorDanger: "#F43F5E",
    fontFamily: "Inter, sans-serif",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      borderColor: "#1C2A3E",
      backgroundColor: "#070D18",
      color: "#FFFFFF",
      boxShadow: "none",
    },
    ".Input:focus": {
      borderColor: "#FFC400",
      boxShadow: "0 0 0 2px rgba(255, 196, 0, 0.25)",
    },
    ".Tab": {
      borderColor: "#1C2A3E",
      backgroundColor: "#0A1220",
      color: "#94A3B8",
    },
    ".Tab--selected": {
      borderColor: "#FFC400",
      backgroundColor: "#141F32",
      color: "#FFC400",
    },
    ".Tab:focus": {
      boxShadow: "0 0 0 2px rgba(255, 196, 0, 0.25)",
    },
    ".Label": {
      color: "#94A3B8",
      fontSize: "12px",
      fontWeight: "600",
    },
  },
};

export function tieneStripePublicoConfigurado(): boolean {
  return Boolean(clavePublica);
}

export interface PagoStripeProps {
  trasladoId: string;
  monto?: number;
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
      "content-type": "application/json",
    },
    body: JSON.stringify({ traslado_id: trasladoId }),
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
 * Componente principal de cobro con Stripe Elements conectado a la pasarela real
 */
export function PagoStripe({ trasladoId, onPagado }: PagoStripeProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeModule, setStripeModule] = useState<any>(null);
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    async function iniciar() {
      try {
        setError(null);
        setClientSecret(null);

        if (!clavePublica) {
          setError("Stripe no está configurado en este entorno. Configura NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
          return;
        }

        const mod = await import("@stripe/react-stripe-js");
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripePromise = await loadStripe(clavePublica);
        if (!stripePromise) {
          throw new Error("No fue posible inicializar Stripe con la clave pública configurada.");
        }
        setStripeModule({
          Elements: mod.Elements,
          PaymentElement: mod.PaymentElement,
          useStripe: mod.useStripe,
          useElements: mod.useElements,
          stripePromise,
        });

        const secret = await crearPaymentIntent(trasladoId);
        setClientSecret(secret);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No pudimos iniciar el cobro con Stripe.";
        if (msg.includes("Failed to load Stripe.js")) {
          setError("No se pudo cargar la pasarela de pagos de Stripe (Stripe.js). Verifica tu conexión a internet o si algún bloqueador de anuncios está interfiriendo.");
        } else {
          setError(msg);
        }
      }
    }

    void iniciar();
  }, [trasladoId, reintento]);

  if (error) {
    return (
      <div className="grid gap-3" role="status" aria-live="polite" aria-atomic="true">
        <Aviso tono="danger">{error}</Aviso>
        <div>
          <Button type="button" variant="secondary" onClick={() => setReintento((valor) => valor + 1)}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!clientSecret || !stripeModule) {
    return (
      <div className="grid gap-4" aria-label="Preparando el cobro seguro">
        <div className="h-12 animate-pulse rounded-xl bg-[#141F32]" />
        <div className="h-12 animate-pulse rounded-xl bg-[#141F32]" />
        <div className="h-11 animate-pulse rounded-xl bg-[#141F32]" />
      </div>
    );
  }

  const { Elements, PaymentElement, useStripe, useElements, stripePromise } = stripeModule;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: aparienciaStripe }}>
      <FormularioPagoReal
        trasladoId={trasladoId}
        onPagado={onPagado}
        PaymentElement={PaymentElement}
        useStripe={useStripe}
        useElements={useElements}
      />
    </Elements>
  );
}

/* Formulario conectado a Stripe Elements Real */
function FormularioPagoReal({
  trasladoId,
  onPagado,
  PaymentElement,
  useStripe,
  useElements,
}: {
  trasladoId: string;
  onPagado: () => void;
  PaymentElement: React.ComponentType<{ options?: unknown }>;
  useStripe: () => unknown;
  useElements: () => unknown;
}) {
  const stripe = useStripe() as any;
  const elements = useElements() as any;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setEnviando(true);
    setError(null);

    const returnUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/traslados/${trasladoId}?pago=exitoso`
        : `http://localhost:3000/traslados/${trasladoId}?pago=exitoso`;

    try {
      const { error: errorPago, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: "if_required",
      });

      if (errorPago) {
        setError(errorPago.message ?? "No pudimos procesar el pago.");
        setEnviando(false);
        return;
      }

      if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
        onPagado();
        return;
      }

      setError(
        "Stripe no confirmó el pago. Revisa el estado de tu tarjeta e inténtalo de nuevo.",
      );
      setEnviando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado al procesar el cobro.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={confirmar} className="space-y-4 text-left">
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-left">
        <div className="flex items-center gap-2 font-display text-xs font-bold text-emerald-400">
          <span>🔒</span>
          <span>Pago protegido con Stripe · Cifrado SSL de 256 bits</span>
        </div>
        <p className="mt-1 font-body text-[11px] leading-relaxed text-[#94A3B8]">
          Tus datos bancarios están cifrados y nunca se almacenan en nuestros servidores.
        </p>
      </div>

      <div className="rounded-xl border border-[#1C2A3E] bg-[#0A1220] p-4">
        <PaymentElement />
      </div>

      {error && <Aviso tono="danger">{error}</Aviso>}

      <button
        type="submit"
        disabled={!stripe || enviando}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FFC400] font-display text-xs sm:text-sm font-black uppercase tracking-wide text-[#0B111B] shadow-lg shadow-[#FFC400]/20 transition hover:bg-[#e6b000] active:scale-[0.99] disabled:opacity-50"
      >
        {enviando ? "Procesando pago con Stripe…" : "Pagar y confirmar traslado"}
      </button>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1 font-body text-[11px] text-[#64748B]">
        <span className="font-semibold text-slate-400">Aceptamos:</span>
        <span className="rounded bg-[#141F32] border border-[#1C2A3E] px-2 py-0.5 text-[#94A3B8]">Visa</span>
        <span className="rounded bg-[#141F32] border border-[#1C2A3E] px-2 py-0.5 text-[#94A3B8]">Mastercard</span>
        <span className="rounded bg-[#141F32] border border-[#1C2A3E] px-2 py-0.5 text-[#94A3B8]">American Express</span>
        <span className="rounded bg-[#141F32] border border-[#1C2A3E] px-2 py-0.5 text-[#94A3B8]">SPEI</span>
      </div>
    </form>
  );
}
