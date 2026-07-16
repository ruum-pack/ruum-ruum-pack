"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso, Field } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { registrarEventoUx } from "../../lib/analytics";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { botonAzul, botonContorno, CampoOscuro, LogoRuum, PantallaPublica } from "../experiencia-publica";

interface LoginClienteProps {
  motivo: string | null;
  siguiente: string;
}

export function LoginCliente({ motivo, siguiente }: LoginClienteProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    registrarEventoUx("login_visto", {
      reason: motivo,
      tiene_next: siguiente !== "/"
    });
  }, [motivo, siguiente]);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    registrarEventoUx("login_enviado", { reason: motivo });

    try {
      const cliente = crearClienteNavegador();
      const { error: errorAuth } = await cliente.auth.signInWithPassword({ email, password });
      if (errorAuth) throw errorAuth;
      registrarEventoUx("login_exitoso", {
        reason: motivo,
        destino_protegido: siguiente !== "/"
      });
      router.push(siguiente);
      router.refresh();
    } catch (err) {
      setError(traducirErrorAuth(err));
      registrarEventoUx("login_error", { reason: motivo });
    } finally {
      setEnviando(false);
    }
  }

  if (!tieneSupabaseConfigurado()) {
    return (
      <PantallaPublica>
        <section className="flex min-h-screen flex-col px-5 py-12 text-center">
          <LogoRuum className="mx-auto" />
          <h1 className="mt-16 font-display text-2xl font-extrabold">Iniciar sesión</h1>
          <div className="mt-6">
            <Aviso tono="peligro">
              Supabase no está configurado todavía. El inicio de sesión no está disponible en este entorno.
            </Aviso>
          </div>
        </section>
      </PantallaPublica>
    );
  }

  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 py-10">
        <Link href="/" className="font-body text-xs text-[#f1d797] transition hover:text-white">
          ← Atrás
        </Link>

        <LogoRuum className="mx-auto mt-8 text-center" />

        <div className="mt-14 rounded-[14px] border border-[#4d5668] bg-[#232a3a] px-5 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">Iniciar sesión</h1>
          <p className="mt-2 font-body text-xs leading-5 text-[#c9cfda]">
            Accede para ver tus traslados reales y solicitar nuevos.
          </p>
          {motivo === "email_confirmation" && (
            <div className="mt-4" role="status">
              <Aviso tono="atencion">
                Para solicitar tu primer traslado debes confirmar tu correo e iniciar sesión.
              </Aviso>
            </div>
          )}
          {motivo === "authentication_required" && (
            <div className="mt-4" role="status">
              <Aviso tono="atencion">
                Inicia sesión para solicitar un traslado. Si acabas de registrarte, confirma primero tu correo.
              </Aviso>
            </div>
          )}

          <form className="mt-7 grid gap-4" onSubmit={iniciarSesion}>
            <CampoOscuro
              etiqueta="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="correo@ejemplo.com"
            />
            <Field
              etiqueta="Contraseña"
              etiquetaClassName="!text-[#d4d9e2] !text-xs !font-medium"
              type="password"
              passwordToggleClassName="!text-white/60 hover:!bg-white/10 hover:!text-white focus-visible:!outline-[#f5a623]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Tu contraseña"
              className="!border-[#4d5668] !bg-[#151a25] !text-white placeholder:!text-[#aeb6c7] focus:!border-[#1e88e5] focus:!ring-[#1e88e5]/25"
            />

            <div className="flex justify-end">
              <Link
                href="/recuperar-password"
                className="font-body text-xs text-[#f1d797] underline-offset-2 hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {error && (
              <div role="status" aria-live="polite" aria-atomic="true">
                <Aviso tono="peligro">{error}</Aviso>
              </div>
            )}

            <button type="submit" disabled={enviando} className={`${botonAzul} mt-2`}>
              {enviando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <Link href="/registro" className={`${botonContorno} mt-4`}>
          Registrarme
        </Link>
      </section>
    </PantallaPublica>
  );
}
