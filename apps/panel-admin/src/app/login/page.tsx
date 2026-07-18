"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso, LogoMarca } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

function errorInicialDesdeUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  // Auditoría H-2 — si el middleware rechazó una sesión no-admin, muestra el
  // motivo en vez de un formulario en blanco.
  return params.get("error") === "no_autorizado"
    ? "Esta cuenta no tiene acceso a la Torre de Control."
    : null;
}

/** Pantalla de acceso para el equipo interno de operación. */
export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(errorInicialDesdeUrl);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.signInWithPassword({ email, password });
      if (errorAuth) throw errorAuth;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(traducirErrorAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="admin-auth-shell flex items-center justify-center px-4 py-10 sm:px-6">
      <section className="admin-auth-card p-6 sm:p-8" aria-labelledby="titulo-acceso-admin">
        <div className="flex items-center gap-3">
          <LogoMarca tamano={34} color="signal" />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-ink">
              ruum<span className="text-signal">ruum</span>
            </p>
            <p className="font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/50">Torre de Control</p>
          </div>
        </div>

        <h1 id="titulo-acceso-admin" className="mt-8 font-display text-2xl font-bold text-ink">Acceso operativo</h1>
        <p className="mt-2 font-body text-sm leading-6 text-ink/65">Consulta traslados, evidencia, incidencias y alertas de la operación.</p>

        {!tieneSupabaseConfigurado() ? (
          <div className="mt-6">
            <Aviso tono="info">Supabase no está configurado todavía. El panel está disponible en modo demo.</Aviso>
          </div>
        ) : (
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

            <Button type="submit" disabled={enviando} className="mt-2 w-full">
              {enviando ? "Entrando…" : "Entrar a la Torre de Control"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
