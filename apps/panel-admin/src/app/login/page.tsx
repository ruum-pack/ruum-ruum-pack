"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

/**
 * PRD §3 — "Admin / Torre de Control: equipo operativo interno." A
 * propósito esta pantalla no tiene un link a "crear cuenta": un admin nunca
 * se autorregistra desde un formulario público. La fila en `admins` se crea
 * manualmente (ver panel-admin/README.md, sección "Cómo crear un admin").
 */
export default function PaginaLogin() {
  const router = useRouter();
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
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar tu sesión.");
    } finally {
      setEnviando(false);
    }
  }

  if (!tieneSupabaseConfigurado()) {
    return (
      <main className="mx-auto max-w-md px-8 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Iniciar sesión</h1>
        <div className="mt-6">
          <Aviso tono="info">
            Supabase no está configurado todavía — el inicio de sesión real no está disponible en este entorno de
            demo. El resto del panel sigue navegable con datos de ejemplo.
          </Aviso>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-8 py-20">
      <h1 className="font-display text-2xl font-semibold">Torre de Control</h1>
      <p className="mt-2 font-body text-sm text-ink/60">Acceso restringido al equipo operativo de Ruum Ruum.</p>

      <form className="mt-8 grid gap-4" onSubmit={iniciarSesion}>
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

        {error && <Aviso tono="peligro">{error}</Aviso>}

        <Button type="submit" disabled={enviando} className="mt-2">
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
