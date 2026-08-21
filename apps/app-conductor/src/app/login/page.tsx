"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { onboardingVisto } from "../../lib/onboarding-visto";

export default function PaginaLogin() {
  const router = useRouter();

  // Primer arranque: mostrar el recorrido de bienvenida antes del acceso.
  useEffect(() => {
    let activo = true;
    onboardingVisto().then((visto) => {
      if (activo && !visto) router.replace("/onboarding");
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
    validarEmail(email);
    if (emailError) return;

    setEnviando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.signInWithPassword({ email, password });
      if (errorAuth) throw errorAuth;
      router.push("/panel");
      router.refresh();
    } catch (err) {
      setError(traducirErrorAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center px-4 py-10 sm:px-6"
      style={{
        background:
          "radial-gradient(circle at 12% 8%, rgba(58,165,255,0.08), transparent 42%)," +
          "radial-gradient(circle at 92% 88%, rgba(168,232,32,0.05), transparent 38%)" +
          "var(--ruum-canvas)"
      }}
    >
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-inicio-conductor">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" descriptor="Conductor" subtitulo="Tu operación, tu control." />
        </div>
        <h1 id="titulo-inicio-conductor" className="mt-8 font-display text-2xl font-bold text-text-primary">Iniciar sesión</h1>

        {!tieneSupabaseConfigurado() && (
          <div className="mt-6">
            <Aviso tono="danger">
              Supabase no está configurado. No es posible iniciar sesión en este entorno.
            </Aviso>
          </div>
        )}

        <form className="mt-7 grid gap-5" onSubmit={iniciarSesion}>
            <Field
              etiqueta="Correo"
              type="email"
              value={email}
              onChange={manejarCambioEmail}
              onBlur={manejarBlurEmail}
              required
              autoComplete="email"
              error={emailError || undefined}
            />
            <Field
              etiqueta="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <output aria-live="polite" aria-atomic="true">
                <Aviso tono="danger">{error}</Aviso>
              </output>
            )}

            <div className="flex items-center justify-end gap-4">
              <Link
                href="/recuperar-password"
                className="font-body text-sm text-route-action underline-offset-2 hover:underline whitespace-nowrap"
                aria-label="Recuperar contraseña"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button type="submit" loading={enviando} disabled={!tieneSupabaseConfigurado() || Boolean(emailError)} className="mt-3 w-full">
              Entrar
            </Button>
        </form>

        <div className="mt-8">
          <Link
            href="/registro"
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl px-5 py-3 w-full font-display text-sm font-bold leading-5 transition-[background-color,border-color,box-shadow,transform] duration-150 border border-border-strong bg-surface text-text-primary shadow-sm hover:-translate-y-0.5 hover:border-route-action hover:bg-surface-elevated hover:shadow-md active:translate-y-0 active:bg-surface-elevated focus-visible:outline-route-action focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:transform-none disabled:border-border disabled:bg-surface-elevated disabled:text-disabled disabled:shadow-none"
            aria-label="Solicitar certificación como conductor"
          >
            Crear cuenta
          </Link>
        </div>
      </section>
    </div>
  );
}
