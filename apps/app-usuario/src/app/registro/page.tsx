"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Aviso } from "@ruum/ui";
import { VERSION_TERMINOS_VIGENTE } from "@ruum/shared/constants";
import { HORAS_HABILES_VERIFICACION_CUENTA_NUEVA } from "@ruum/shared/rules";
import { registrarAceptacionTerminos } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export default function PaginaRegistro() {
  const router = useRouter();
  const [tipoCuenta, setTipoCuenta] = useState<"personal" | "empresa">("personal");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crearCuenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!aceptaTerminos) {
      setError("Debes aceptar los Términos y condiciones y el Aviso de privacidad para continuar.");
      return;
    }

    setEnviando(true);

    if (!tieneSupabaseConfigurado()) {
      await new Promise((r) => setTimeout(r, 500));
      setEnviado(true);
      setEnviando(false);
      return;
    }

    try {
      const cliente = crearClienteNavegador();
      const terminosAceptadosEn = new Date().toISOString();
      const { data: datosAuth, error: errorAuth } = await cliente.auth.signUp({
        email,
        password,
        options: {
          data: {
            tipo_registro: "usuario",
            nombre,
            telefono,
            tipo_cuenta: tipoCuenta,
            version_terminos_aceptada: VERSION_TERMINOS_VIGENTE,
            terminos_aceptados_en: terminosAceptadosEn
          }
        }
      });

      if (errorAuth) throw errorAuth;
      if (!datosAuth.user) throw new Error("No se pudo crear la cuenta. Intenta de nuevo.");

      try {
        await registrarAceptacionTerminos(cliente, datosAuth.user.id);
      } catch {
        // La cuenta ya existe; si este update falla se puede corregir desde soporte/admin.
      }

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
        <h1 className="font-display text-2xl font-semibold">Cuenta en revisión</h1>
        <p className="mt-3 font-body text-sm text-ink/60">
          Verificamos cuentas nuevas en menos de {HORAS_HABILES_VERIFICACION_CUENTA_NUEVA} horas hábiles. Te
          avisaremos en cuanto esté lista.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.push("/verificacion")}>Subir identificación</Button>
        </div>
        {tieneSupabaseConfigurado() && (
          <p className="mt-4 font-body text-xs text-ink/45">
            Si tu proyecto de Supabase exige confirmar el correo, revisa tu bandeja antes de iniciar sesión.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-display text-2xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 font-body text-sm text-ink/60">
        Una cuenta verificada te permite solicitar traslados y, con historial, pagar al cierre en vez de por
        adelantado.
      </p>

      {!tieneSupabaseConfigurado() && (
        <div className="mt-4">
          <Aviso tono="info">Supabase no está configurado: esta cuenta no se guardará de verdad (modo demo).</Aviso>
        </div>
      )}

      <form className="mt-8 grid gap-4" onSubmit={crearCuenta}>
        <fieldset className="flex gap-4 font-body text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_cuenta"
              checked={tipoCuenta === "personal"}
              onChange={() => setTipoCuenta("personal")}
            />
            Personal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tipo_cuenta"
              checked={tipoCuenta === "empresa"}
              onChange={() => setTipoCuenta("empresa")}
            />
            Empresa
          </label>
        </fieldset>

        <Field etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <Field
          etiqueta="Teléfono (con código de país, ej. +52...)"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          required
          autoComplete="tel"
        />
        <Field etiqueta="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <Field
          etiqueta="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />

        <div className="mt-2 rounded-xl border border-ink/10 bg-mist p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-ink/30 accent-signal"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              required
            />
            <span className="font-body text-sm leading-snug text-ink/70">
              He leído y acepto los{" "}
              <a href="/soporte#terminos" target="_blank" className="font-medium text-route underline-offset-2 hover:underline">
                Términos y condiciones
              </a>{" "}
              y el{" "}
              <a href="/soporte#privacidad" target="_blank" className="font-medium text-route underline-offset-2 hover:underline">
                Aviso de privacidad
              </a>{" "}
              de Ruum Ruum.
            </span>
          </label>
        </div>

        {error && <Aviso tono="peligro">{error}</Aviso>}
        <Aviso tono="info">Después de crear tu cuenta te pediremos un documento de identidad para verificarla.</Aviso>

        <Button type="submit" disabled={enviando || !aceptaTerminos} className="mt-2">
          {enviando ? "Creando…" : "Crear cuenta"}
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
