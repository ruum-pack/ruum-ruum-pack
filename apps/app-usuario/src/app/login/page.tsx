"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { traducirErrorAuth } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { botonAzul, botonContorno, CampoOscuro, LogoRuum, PantallaPublica } from "../experiencia-publica";

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
      const searchParams = new URLSearchParams(window.location.search);
      const next = searchParams.get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(traducirErrorAuth(err));
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
        <Link href="/" className="font-body text-xs text-[#8fb9ef] transition hover:text-white">
          ← Atrás
        </Link>

        <LogoRuum className="mx-auto mt-8 text-center" />

        <div className="mt-14 rounded-[14px] border border-[#223553] bg-[#0a1429] px-5 py-7 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">Iniciar sesión</h1>
          <p className="mt-2 font-body text-xs leading-5 text-[#90a8c5]">
            Accede para ver tus traslados reales y solicitar nuevos.
          </p>

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
            <CampoOscuro
              etiqueta="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Tu contraseña"
            />

            {error && <Aviso tono="peligro">{error}</Aviso>}

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
