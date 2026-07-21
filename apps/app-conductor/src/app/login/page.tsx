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

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
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
          "radial-gradient(circle at 92% 88%, rgba(168,232,32,0.05), transparent 38%)," +
          "var(--ruum-canvas)"
      }}
    >
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-inicio-conductor">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-text-primary">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-body text-xs font-semibold text-text-tertiary">Tu operación, tu control</p>
          </div>
        </div>

        <h1 id="titulo-inicio-conductor" className="mt-8 font-display text-2xl font-bold text-text-primary">Iniciar sesión</h1>
        <p className="mt-2 font-body text-sm leading-6 text-text-secondary">Accede a tus viajes, registro del vehículo y ganancias operativas.</p>

        {!tieneSupabaseConfigurado() && (
          <div className="mt-6">
            <Aviso tono="danger">
              Supabase no está configurado. No es posible iniciar sesión en este entorno.
            </Aviso>
          </div>
        )}

        <form className="mt-7 grid gap-4" onSubmit={iniciarSesion}>
            <Field
              etiqueta="Correo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
              <div role="status" aria-live="polite" aria-atomic="true">
                <Aviso tono="danger">{error}</Aviso>
              </div>
            )}

            <div className="flex justify-end">
              <Link
                href="/recuperar-password"
                className="font-body text-xs text-route-action underline-offset-2 hover:underline"
                aria-label="Recuperar contraseña"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button type="submit" loading={enviando} disabled={!tieneSupabaseConfigurado()} className="mt-2 w-full">
              Entrar
            </Button>
        </form>

        <p className="mt-6 text-center font-body text-sm text-text-secondary">
          ¿Todavía no eres conductor certificado?{" "}
          <Link href="/registro" className="font-semibold text-route-action hover:underline" aria-label="Solicitar certificación como conductor">
            Solicitar certificación
          </Link>
        </p>
      </section>
    </div>
  );
}
