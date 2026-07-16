"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { botonAzul, botonContorno, LogoRuum, PantallaPublica } from "../../experiencia-publica";
import { useSearchParams } from 'next/navigation';

const COOLDOWN_SEGUNDOS = 60;

function correoInicial(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem("ruum:correo-confirmacion") ?? "";
  } catch {
    return "";
  }
}

function restanteInicial(): number {
  if (typeof window === "undefined") return 0;
  try {
    const hasta = Number(window.sessionStorage.getItem("ruum:reenvio-confirmacion-hasta") ?? 0);
    return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function ContenidoConfirmaCorreo() {
  const [restante, setRestante] = useState(restanteInicial);
  const [reenviando, setReenviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";
  const hayCooldown = restante > 0;
  const [correo] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return emailFromUrl || (window.sessionStorage.getItem("ruum:correo-confirmacion") ?? "");
    } catch {
      return emailFromUrl || "";
    }
  });
  useEffect(() => {
    if (!hayCooldown) return;
    const timer = window.setInterval(() => setRestante((valor) => Math.max(0, valor - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [hayCooldown]);

  

  async function reenviar() {
    if (!correo || restante > 0 || reenviando) return;
    setReenviando(true);
    setMensaje(null);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.resend({
        type: "signup",
        email: correo,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding?nuevo=1` }
      });
      if (errorAuth) throw errorAuth;
      const hasta = Date.now() + COOLDOWN_SEGUNDOS * 1000;
      localStorage.setItem("ruum:reenvio-confirmacion-hasta", String(hasta));
      setRestante(COOLDOWN_SEGUNDOS);
      setMensaje("Si el correo corresponde a una cuenta pendiente, enviamos un nuevo enlace de confirmación.");
    } catch (err) {
      setError(traducirErrorAuth(err, "No pudimos reenviar el correo. Espera un momento e intenta nuevamente."));
    } finally {
      setReenviando(false);
    }
     const hasta = Number(localStorage.getItem("ruum:reenvio-confirmacion-hasta") ?? 0);
  }
// Dentro del componente, antes del return
if (!correo) {
  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 py-10 text-center">
        <LogoRuum className="mx-auto mt-8" />
        <div className="mt-12 rounded-[14px] border border-[#4d5668] bg-[#232a3a] px-5 py-7">
          <h1 className="font-display text-[22px] font-extrabold text-white">No encontramos tu correo</h1>
          <p className="mt-3 font-body text-sm text-[var(--ruum-dark-text-secondary)]">
            El correo electrónico no está disponible. Puedes volver a la página de registro para intentarlo de nuevo.
          </p>
          <Link href="/registro" className={`${botonAzul} mt-6 inline-block`}>
            Volver a registrarme
          </Link>
        </div>
      </section>
    </PantallaPublica>
  );
}
  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 py-10">
        <LogoRuum className="mx-auto mt-8 text-center" />
        <div className="mt-12 rounded-[14px] border border-[#4d5668] bg-[#232a3a] px-5 py-7 text-center shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f5a623]/15 text-[#f5a623]" aria-hidden>✉</div>
          <h1 className="mt-5 font-display text-[22px] font-extrabold text-white">Revisa tu correo</h1>
          <p className="mt-3 font-body text-sm leading-6 text-[var(--ruum-dark-text-secondary)]">
            Enviamos un enlace de confirmación{correo ? <> a <strong className="text-white">{correo}</strong></> : " al correo registrado"}.
            Ábrelo para activar tu cuenta.
          </p>
          <p className="mt-3 font-body text-xs leading-5 text-[var(--ruum-dark-text-secondary)]">
            Si no lo encuentras, revisa spam o correo no deseado. Hasta confirmar tu correo todavía no puedes solicitar un traslado.
          </p>

          {mensaje && <div className="mt-5" role="status"><Aviso tono="info">{mensaje}</Aviso></div>}
          {error && <div className="mt-5" role="alert"><Aviso tono="peligro">{error}</Aviso></div>}

          <button type="button" onClick={reenviar} disabled={!correo || reenviando || restante > 0} className={`${botonAzul} mt-6`}>
            {reenviando ? "Enviando…" : restante > 0 ? `Reenviar en ${restante}s` : "Reenviar correo"}
          </button>
          <Link href="/login" className={`${botonContorno} mt-3`}>Volver al inicio de sesión</Link>
          <Link href="/registro" className="mt-5 inline-block font-body text-xs text-[#f1d797] underline-offset-4 hover:underline">
            Corregir el correo o volver a registrarme
          </Link>
        </div>
      </section>
    </PantallaPublica>
  );
}

export default function PaginaConfirmaCorreo() {
  return (
    <Suspense fallback={null}>
      <ContenidoConfirmaCorreo />
    </Suspense>
  );
}
