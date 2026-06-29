"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export default function PaginaRegistroConductor() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    if (!tieneSupabaseConfigurado()) {
      await new Promise((r) => setTimeout(r, 500));
      setEnviado(true);
      setEnviando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();

      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email,
        password,
        options: { data: { tipo_registro: "conductor", nombre, telefono } }
      });
      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");

      // 0024_trigger_alta_cuenta.sql crea la fila en conductores
      // automáticamente (mismo bug real que app-usuario/registro: con
      // confirmación de correo activada, signUp() no da sesión de
      // inmediato, así que un insert manual aquí fallaba contra RLS).
      // conductores.estado ya tiene default 'pendiente_verificacion' (0003)
      // — es el comportamiento correcto recién registrado (PRD §4.13:
      // validación CONCER antes de operar).

      setEnviado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear tu cuenta. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Solicitud en revisión</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Tu cuenta queda pendiente de validación CONCER. En cuanto subas tus documentos desde Configuración (PRD
          §16.5.2 — pendiente en este corte) y un coordinador los apruebe, podrás ver y aceptar viajes.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Solicitar certificación CONCER</h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        Crea tu cuenta para empezar el proceso de validación como conductor certificado.
      </p>

      {!tieneSupabaseConfigurado() && (
        <div className="mt-4">
          <Aviso tono="info">Supabase no está configurado: esta cuenta no se guardará de verdad (modo demo).</Aviso>
        </div>
      )}

      <form className="mt-8 grid gap-4" onSubmit={crearCuenta}>
        <Field etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <Field
          etiqueta="Teléfono (con código de país, ej. +52...)"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
          autoComplete="tel"
        />
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
          minLength={6}
          autoComplete="new-password"
        />

        {error && <Aviso tono="peligro">{error}</Aviso>}

        <Button type="submit" disabled={enviando} className="mt-2">
          {enviando ? "Enviando…" : "Solicitar certificación"}
        </Button>
      </form>

      <p className="mt-6 text-center font-body text-sm text-ink/55">
        ¿Ya tienes cuenta?{" "}
        <button onClick={() => router.push("/login")} className="font-medium text-route hover:underline">
          Inicia sesión
        </button>
      </p>
    </main>
  );
}
