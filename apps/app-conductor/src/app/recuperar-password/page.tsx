"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export default function PaginaRecuperarPasswordConductor() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        { redirectTo: `${window.location.origin}/nueva-password` }
      );
      if (errorAuth) throw errorAuth;
      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar el correo. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="conductor-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="conductor-auth-card p-6 sm:p-8" aria-labelledby="titulo-recuperar">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-ink">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/50">Conductor</p>
          </div>
        </div>

        <h1 id="titulo-recuperar" className="mt-8 font-display text-2xl font-bold text-ink">
          Recuperar contraseña
        </h1>
        <p className="mt-2 font-body text-sm leading-6 text-ink/65">
          Escribe el correo con el que te registraste y te enviamos un enlace.
        </p>

        {enviado ? (
          <div className="mt-6 grid gap-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e6f9f0]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#1d9e75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <p className="font-body text-sm leading-6 text-ink/70">
              Correo enviado a <strong>{email}</strong>. Revisa tu bandeja incluyendo spam. El enlace expira en 60 minutos.
            </p>
            <button
              type="button"
              onClick={() => { setEnviado(false); setEmail(""); }}
              className="font-body text-sm text-route-dark underline-offset-2 hover:underline"
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
              <div role="status" aria-live="polite" aria-atomic="true">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
            )}
            <Button type="submit" disabled={enviando} className="mt-2 w-full">
              {enviando ? TEXTOS_CARGANDO.enviando : "Enviar enlace"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center font-body text-sm text-ink/60">
          <Link href="/login" className="font-semibold text-route-dark hover:underline">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </section>
    </div>
  );
}
