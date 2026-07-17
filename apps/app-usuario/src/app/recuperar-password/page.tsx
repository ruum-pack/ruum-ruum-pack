"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { registrarEventoUx } from "../../lib/analytics";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import {
  botonAzul,
  botonContorno,
  CampoOscuro,
  LogoRuum,
  PantallaPublica,
} from "../experiencia-publica";

export default function PaginaRecuperarPassword() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registrarEventoUx("recuperacion_vista");
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Escribe tu correo electrónico.");
      registrarEventoUx("recuperacion_error", { motivo: "email_vacio" });
      return;
    }
    setEnviando(true);
    setError(null);
    registrarEventoUx("recuperacion_enviada");

    try {
      if (!tieneSupabaseConfigurado()) {
        throw new Error("Supabase no está configurado en este entorno.");
      }
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/nueva-password` }
      );
      if (errorAuth) throw errorAuth;
      setEnviado(true);
      registrarEventoUx("recuperacion_exitosa");
    } catch (err) {
      setError(traducirErrorAuth(err, "No pudimos enviar el correo. Intenta de nuevo."));
      registrarEventoUx("recuperacion_error", { motivo: "proveedor" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 py-10">
        <Link href="/login" className="font-body text-xs text-[#f1d797] transition hover:text-white">
          ← Volver al inicio de sesión
        </Link>

        <LogoRuum className="mx-auto mt-8 text-center" />

        <div className="mt-14 rounded-[14px] border border-[#4d5668] bg-[#232a3a] px-5 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          {enviado ? (
            /* Estado de éxito */
            <div className="grid gap-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e6f9f0]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="#1d9e75" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
                Correo enviado
              </h1>
              <p className="font-body text-sm leading-6 text-[var(--ruum-dark-text-secondary)]">
                Revisa tu bandeja de entrada en{" "}
                <span className="font-semibold text-white">{email}</span>, incluyendo
                la carpeta de spam. El enlace expira en 60 minutos.
              </p>
              <p className="font-body text-xs text-[#8d96a8]">
                Si no llega en unos minutos, puedes solicitar otro enlace.
              </p>
              <button
                type="button"
                onClick={() => { setEnviado(false); setEmail(""); }}
                className={botonContorno}
              >
                Solicitar otro enlace
              </button>
            </div>
          ) : (
            /* Formulario */
            <>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
                Recuperar contraseña
              </h1>
              <p className="mt-2 font-body text-xs leading-5 text-[var(--ruum-dark-text-secondary)]">
                Escribe el correo con el que te registraste y te enviamos un enlace para crear una nueva contraseña.
              </p>

              <form className="mt-7 grid gap-4" onSubmit={enviar}>
                <CampoOscuro
                  etiqueta="Correo electrónico"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                />

                {error && (
                  <div aria-live="polite" aria-atomic="true">
                    <Aviso tono="danger">{error}</Aviso>
                  </div>
                )}

                <button type="submit" disabled={enviando} className={`${botonAzul} mt-2`}>
                  {enviando ? TEXTOS_CARGANDO.enviando : "Enviar enlace de recuperación"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </PantallaPublica>
  );
}
