"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Field, Aviso } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

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
      setError(traducirErrorAuth(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!tieneSupabaseConfigurado()) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Iniciar sesión</h1>
        <div className="mt-6">
          <Aviso tono="info">
            Supabase no está configurado todavía — el inicio de sesión real no está disponible en este entorno de
            demo. El resto de la app sigue navegable con datos de ejemplo.
          </Aviso>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Iniciar sesión</h1>
      <p className="mt-2 font-body text-sm text-ink/60">Accede para ver tus viajes y tu evidencia reales.</p>

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

      <p className="mt-6 text-center font-body text-sm text-ink/55">
        ¿Todavía no eres conductor certificado?{" "}
        <Link href="/registro" className="font-medium text-route hover:underline">
          Solicitar certificación
        </Link>
      </p>
    </main>
  );
}
