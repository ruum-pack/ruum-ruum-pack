"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado, obtenerOriginApp } from "../../lib/supabase-browser";
import { traducirErrorAuth } from "@ruum/shared/utils";

export default function PaginaRecuperarPasswordConductor() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "enlace_invalido") {
        setError("El enlace para restablecer tu contraseña no es válido o ya ha expirado. Por favor, solicita uno nuevo.");
      }
    }
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Escribe tu correo electrónico."); return; }
    setEnviando(true);
    setError(null);
    try {
      if (!tieneSupabaseConfigurado()) throw new Error("Supabase no está configurado.");
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${obtenerOriginApp()}/auth/callback?type=recovery&next=/nueva-password` }
      );
      if (errorAuth) throw errorAuth;
      setEnviado(true);
    } catch (err) {
      setError(traducirErrorAuth(err, "No pudimos enviar el correo. Intenta de nuevo."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-recuperar">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" descriptor="Traslado vehicular con conductores certificados" />
        </div>
        <p className="mt-2 font-body text-[11px] font-medium tracking-wide text-text-tertiary">Seguridad, evidencia y trazabilidad en cada viaje. · by MoviliaX</p>
        <div className="conductor-ruta-divider mt-3" aria-hidden />

        <h1 id="titulo-recuperar" className="mt-6 font-display text-2xl font-bold tracking-tight text-text-primary">
          Recuperar contraseña
        </h1>
         <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
           Escribe el correo con el que te registraste y te enviamos un enlace seguro.
         </p>

        {enviado ? (
          <div className="mt-6 grid gap-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-control-soft text-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <p className="font-body text-sm leading-6 text-text-tertiary/80">
              Correo enviado a <strong>{email}</strong>. Revisa tu bandeja incluyendo spam. El enlace expira en 60 minutos.
            </p>
            <p className="font-body text-xs leading-5 text-text-tertiary/70">
              Ábrelo desde este mismo teléfono y navegador — por seguridad, no funciona si lo abres en otro dispositivo.
            </p>
            <button
              type="button"
              onClick={() => { setEnviado(false); setEmail(""); }}
              className="font-body text-sm font-semibold text-route-action underline-offset-2 hover:underline"
            >
              Solicitar otro enlace
            </button>
          </div>
        ) : (
          <form className="mt-7 grid gap-4" onSubmit={enviar}>
            <Field
              etiqueta="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {error && (
              <output aria-live="polite" aria-atomic="true">
                <Aviso tono="danger">{error}</Aviso>
              </output>
            )}
            <Button type="submit" loading={enviando} className="mt-2 w-full">
              Enviar enlace
            </Button>
          </form>
        )}

        <p className="mt-6 text-center font-body text-sm text-text-tertiary/80">
          <Link href="/login" className="font-semibold text-route-action hover:underline">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </section>
    </div>
  );
}
