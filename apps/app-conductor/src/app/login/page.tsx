"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { onboardingVisto } from "../../lib/onboarding-visto";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../lib/contactos-soporte";

function LoginSkeleton() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6" aria-busy="true" aria-label="Cargando acceso">
      <div className="conductor-auth-card p-6 sm:p-8 w-full animate-pulse">
        <div className="h-8 w-32 rounded bg-surface-elevated" />
        <div className="mt-4 h-2 w-full rounded bg-surface-elevated" />
        <div className="mt-8 h-12 w-full rounded-xl bg-surface-elevated" />
        <div className="mt-4 h-12 w-full rounded-xl bg-surface-elevated" />
        <div className="mt-6 h-12 w-full rounded-xl bg-surface-elevated" />
      </div>
    </div>
  );
}

export default function PaginaLogin() {
  const router = useRouter();

  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  // Primer arranque: mostrar el recorrido de bienvenida antes del acceso.
  useEffect(() => {
    let activo = true;
    onboardingVisto()
      .then((visto) => {
        if (activo && !visto) {
          router.replace("/onboarding");
          return;
        }
        if (activo) setCheckingOnboarding(false);
      })
      .catch(() => {
        if (activo) setCheckingOnboarding(false);
      });
    return () => {
      activo = false;
    };
  }, [router]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const validarEmail = (value: string) => {
    if (!value) {
      setEmailError(null);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError("Formato de correo inválido");
    } else {
      setEmailError(null);
    }
  };

  const manejarCambioEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    validarEmail(value);
  };

  const manejarBlurEmail = () => {
    if (email && !emailError) {
      validarEmail(email);
    }
  };

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      setEmailError("Formato de correo inválido");
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña para continuar.");
      return;
    }
    if (emailError) return;

    setEnviando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.signInWithPassword({ email: email.trim(), password });
      if (errorAuth) throw errorAuth;
      router.replace("/panel");
    } catch (err) {
      setError(traducirErrorAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  if (checkingOnboarding) {
    return <LoginSkeleton />;
  }

  const supabaseNoConfigurado = !tieneSupabaseConfigurado();

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6"
      style={{
        background:
          "radial-gradient(circle at 12% 8%, rgba(30,136,229,0.06), transparent 42%)," +
          "radial-gradient(circle at 92% 88%, rgba(255,196,0,0.05), transparent 38%)," +
          "var(--ruum-canvas)"
      }}
    >
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-inicio-conductor">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" descriptor="Traslado vehicular con conductores certificados" />
        </div>
        <p className="mt-2 font-body text-[11px] font-medium tracking-wide text-text-tertiary">Seguridad, evidencia y trazabilidad en cada viaje. · by MoviliaX</p>
        <div className="conductor-ruta-divider mt-4" aria-hidden />
        <h1 id="titulo-inicio-conductor" className="mt-6 font-display text-2xl font-bold tracking-tight text-text-primary">Iniciar sesión</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">Solo conductores verificados. Tu sesión inicia trazabilidad.</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-signal/20 bg-signal/10 px-3 py-1 font-body text-[11px] font-semibold text-signal">
          <span className="size-1.5 rounded-full bg-signal" aria-hidden /> Evidencia · GPS · Pagos trazables
        </p>

        {supabaseNoConfigurado && (
          <div className="mt-6">
            <Aviso tono="atencion">
              Entorno sin conexión a Supabase. No es posible iniciar sesión ahora. Contacta a soporte si el problema persiste.
            </Aviso>
          </div>
        )}

        <form className="mt-7 grid gap-5" onSubmit={iniciarSesion} noValidate>
            <Field
              etiqueta="Correo"
              type="email"
              value={email}
              onChange={manejarCambioEmail}
              onBlur={manejarBlurEmail}
              required
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              error={emailError || undefined}
              ayuda={supabaseNoConfigurado ? "Servicio no disponible en este entorno" : undefined}
              disabled={supabaseNoConfigurado}
            />
            <div className="grid gap-2">
              <Field
                etiqueta="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={supabaseNoConfigurado}
              />
              <div className="flex">
                <Link
                  href="/recuperar-password"
                  className="inline-flex min-h-11 items-center rounded-lg px-1 py-2 font-body text-sm font-semibold text-route-action underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                  aria-label="Recuperar contraseña"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {error && (
              <output aria-live="polite" aria-atomic="true">
                <Aviso tono="danger">{error}</Aviso>
              </output>
            )}

            <Button type="submit" loading={enviando} disabled={supabaseNoConfigurado || Boolean(emailError)} className="mt-1 w-full">
              Entrar
            </Button>
            <p className="text-center font-body text-xs leading-5 text-text-tertiary">
              Al continuar aceptas los <Link href="/legal/terminos" className="font-semibold text-route-action hover:underline">Términos</Link> y el{" "}
              <Link href="/legal/privacidad" className="font-semibold text-route-action hover:underline">Aviso de Privacidad</Link>.
            </p>
        </form>

        <div className="mt-6 rounded-xl border border-border/40 bg-surface-elevated/50 px-4 py-3">
          <p className="font-body text-sm text-text-secondary">
            ¿Aún no estás certificado?{" "}
            <Link
              href="/registro"
              className="font-display text-sm font-bold text-signal hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action rounded"
              aria-label="Solicitar certificación como conductor"
            >
              Crea tu cuenta →
            </Link>
          </p>
          <p className="mt-1 font-body text-xs text-text-tertiary">Validación de identidad en minutos. Sin costo de registro.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-border/15 pt-4">
          <span className="font-body text-xs text-text-tertiary">¿Problemas para entrar?</span>
          <a
            href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-body text-xs font-bold text-emerald-600 hover:bg-emerald-500/15 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action dark:text-emerald-400"
          >
            WhatsApp soporte
          </a>
          <a
            href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 font-body text-xs font-bold text-text-primary hover:bg-surface-elevated focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
          >
            Llamar
          </a>
        </div>
      </section>
    </div>
  );
}
