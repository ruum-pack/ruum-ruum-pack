"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Aviso } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { registrarEventoUx } from "../../../lib/analytics";
import { botonAzul, botonContorno, LogoRuum, PantallaPublica } from "../../experiencia-publica";
import {
  CLAVE_CORREO_CONFIRMACION,
  CLAVE_REENVIO_CONFIRMACION_HASTA,
  crearRedirectConfirmacion,
  normalizarCorreoRegistro,
  soloDigitos
} from "../../../lib/registro-usuario";

const COOLDOWN_SEGUNDOS = 60;

function correoInicial(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizarCorreoRegistro(window.sessionStorage.getItem(CLAVE_CORREO_CONFIRMACION) ?? "");
  } catch {
    return "";
  }
}

function restanteInicial(): number {
  if (typeof window === "undefined") return 0;
  try {
    const hasta = Number(window.localStorage.getItem(CLAVE_REENVIO_CONFIRMACION_HASTA) ?? 0);
    return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function ContenidoConfirmaCorreo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [restante, setRestante] = useState(restanteInicial);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailFromUrl = normalizarCorreoRegistro(searchParams.get("email") || "");
  const hayCooldown = restante > 0;
  const [correo] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return emailFromUrl || correoInicial();
    } catch {
      return emailFromUrl || "";
    }
  });

  useEffect(() => {
    registrarEventoUx("registro_confirmacion_vista");
  }, []);

  useEffect(() => {
    if (!hayCooldown) return;
    const timer = window.setInterval(() => setRestante((valor) => Math.max(0, valor - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [hayCooldown]);

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    const codigoLimpio = soloDigitos(codigo, 6);
    if (codigoLimpio.length !== 6) {
      setError("Escribe el código de verificación de 6 dígitos que recibiste por correo.");
      return;
    }

    setVerificando(true);
    setMensaje(null);
    setError(null);
    registrarEventoUx("registro_confirmacion_enviada");

    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.verifyOtp({
        email: correo,
        token: codigoLimpio,
        type: "email"
      });
      if (errorAuth) throw errorAuth;

      registrarEventoUx("registro_confirmacion_exitosa");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(traducirErrorAuth(err, "No pudimos verificar el código. Revisa que esté escrito correctamente e inténtalo de nuevo."));
      registrarEventoUx("registro_confirmacion_error");
    } finally {
      setVerificando(false);
    }
  }

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
        options: { emailRedirectTo: crearRedirectConfirmacion(window.location.origin) }
      });
      if (errorAuth) throw errorAuth;
      const hasta = Date.now() + COOLDOWN_SEGUNDOS * 1000;
      window.localStorage.setItem(CLAVE_REENVIO_CONFIRMACION_HASTA, String(hasta));
      try {
        window.sessionStorage.setItem(CLAVE_CORREO_CONFIRMACION, correo);
      } catch { /* El query param mantiene disponible el correo si sessionStorage falla. */ }
      setRestante(COOLDOWN_SEGUNDOS);
      setMensaje("Si el correo corresponde a una cuenta pendiente, enviamos un nuevo enlace de confirmación.");
    } catch (err) {
      setError(traducirErrorAuth(err, "No pudimos reenviar el correo. Espera un momento e intenta nuevamente."));
    } finally {
      setReenviando(false);
    }
  }
  if (!correo) {
    return (
      <PantallaPublica>
        <section className="flex min-h-screen flex-col px-5 py-10 text-center">
          <LogoRuum className="mx-auto mt-8" />
          <div className="mt-12 rounded-card border border-border bg-surface px-5 py-7">
            <h1 className="font-display text-[22px] font-extrabold text-text-primary">No encontramos tu correo</h1>
            <p className="mt-3 font-body text-sm text-text-secondary">
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
      <section className="flex min-h-screen flex-col px-5 py-10" aria-labelledby="confirmar-correo-titulo">
        <LogoRuum className="mx-auto mt-8 text-center" />
        <div className="mt-12 rounded-card border border-border bg-surface px-5 py-7 text-center shadow-[var(--ruum-shadow-3)]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-signal/15 text-signal" aria-hidden>✉</div>
          <h1 id="confirmar-correo-titulo" className="mt-5 font-display text-[22px] font-extrabold leading-tight text-text-primary">
            Confirma tu correo electrónico
          </h1>
          <p className="mt-3 font-body text-sm leading-6 text-text-secondary">Hola,</p>
          <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
            Ingresa el siguiente código de verificación en la aplicación para activar tu cuenta:
          </p>

          <form className="mt-6 grid gap-4" onSubmit={confirmarCodigo}>
            <label htmlFor="codigo-verificacion" className="font-body text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
              Código de verificación
            </label>
            <input
              id="codigo-verificacion"
              aria-describedby="codigo-verificacion-ayuda"
              aria-label="Código de verificación"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(soloDigitos(e.target.value, 6))}
              aria-required="true"
              aria-invalid={Boolean(error)}
              className="w-full rounded-lg border border-border bg-surface px-3.5 py-3 text-center font-display text-2xl font-extrabold tracking-[0.45em] text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-route-action focus:ring-2 focus:ring-route-action/25"
              placeholder="000000"
            />
            <span id="codigo-verificacion-ayuda" className="font-body text-xs leading-5 text-text-tertiary">
              Lo encontrarás en el correo enviado a <strong className="text-text-primary">{correo}</strong>.
            </span>

            {mensaje && <div role="status"><Aviso tono="info">{mensaje}</Aviso></div>}
            {error && <div role="alert"><Aviso tono="danger">{error}</Aviso></div>}

            <button type="submit" disabled={verificando || reenviando} className={`${botonAzul} mt-1`}>
              {verificando ? "Verificando…" : "Verificar mi cuenta"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-5">
            <p className="font-body text-xs leading-5 text-text-secondary">
              O si prefieres, confirma directamente haciendo clic en <strong className="text-text-primary">Verificar mi cuenta</strong> dentro del correo.
            </p>
            <p className="mt-3 font-body text-xs leading-5 text-text-tertiary">
              Si no solicitaste crear una cuenta en Ruum Ruum, puedes ignorar este mensaje con total tranquilidad.
            </p>
          </div>

          <button type="button" onClick={reenviar} disabled={verificando || reenviando || restante > 0} className={`${botonContorno} mt-5`}>
            {reenviando ? "Enviando…" : restante > 0 ? `Reenviar código en ${restante}s` : "Reenviar código"}
          </button>
          <Link href="/login" className={`${botonContorno} mt-3`}>Volver al inicio de sesión</Link>
          <Link href="/registro" className="mt-5 inline-block font-body text-xs text-route-action underline-offset-4 hover:underline">
            Corregir el correo o volver a registrarme
          </Link>
          <p className="mt-8 font-body text-[11px] leading-5 text-text-tertiary">
            Seguridad, evidencia y trazabilidad en cada viaje.<br />
            © 2026 Ruum Ruum by MoviliaX. Todos los derechos reservados.
          </p>
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
