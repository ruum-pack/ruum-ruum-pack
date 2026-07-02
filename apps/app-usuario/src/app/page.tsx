import Link from "next/link";
import { LogoMarca } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { BotonCerrarSesion } from "./BotonCerrarSesion";
import { InicioUsuario } from "./InicioUsuario";
import { botonAzul, botonContorno, LogoRuum, PantallaPublica } from "./experiencia-publica";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

interface ContextoSesion {
  usuario: UsuarioRow | null;
  traslados: PasaporteRow[];
}
async function obtenerContextoSesion(): Promise<ContextoSesion> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { usuario: null, traslados: [] };

  try {
    const { crearClienteServidor } = await import("../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");

    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    if (!usuario) return { usuario: null, traslados: [] };

    const traslados = await listarTrasladosDeUsuario(cliente, usuario.id);
    return { usuario, traslados };
  } catch {
    return { usuario: null, traslados: [] };
  }
}

export default async function PaginaInicio() {
  const { usuario, traslados } = await obtenerContextoSesion();
  const sesion = Boolean(usuario);

  if (sesion) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <header className="mb-10 flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <LogoMarca tamano={26} color="signal" />
            <span className="font-display text-lg font-bold tracking-tight">
              <span className="text-signal">ruum</span>ruum
            </span>
          </span>
          <div className="flex items-center gap-5">
            <Link href="/soporte" className="font-body text-sm text-ink/60 underline-offset-4 hover:underline">
              Soporte
            </Link>
            {sesion ? (
              <BotonCerrarSesion />
            ) : (
              <Link href="/login" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
                Iniciar sesión
              </Link>
            )}
          </div>
        </header>
        <InicioUsuario usuario={usuario} traslados={traslados} />
      </main>
    );
  }

  // Sin sesión: entrada móvil pública alineada con el onboarding.
  return (
    <PantallaPublica>
      <section className="flex min-h-screen flex-col px-5 pb-10 pt-14">
        <LogoRuum className="mx-auto text-center" />

        <div className="mt-10 overflow-hidden rounded-xl border border-[#113259] bg-[#030817] shadow-[0_0_45px_rgba(22,131,255,0.16)]">
          <img
            src="/imagenes/seguridad-traslado.png"
            alt="Traslado vehicular protegido con verificacion de identidad"
            className="aspect-[1.06] w-full object-cover object-[44%_54%]"
          />
        </div>

        <div className="mt-auto">
          <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.01em] text-white">
            Bienvenido
          </h1>
          <p className="mt-2 font-body text-xs text-[#90a8c5]">Inicia sesión para continuar</p>

          <div className="mt-5 grid gap-2.5">
            <Link href="/login" className={botonAzul}>
              Iniciar sesión
            </Link>
            <Link href="/registro" className={botonContorno}>
              Registrarme
            </Link>
          </div>
        </div>
      </section>
    </PantallaPublica>
  );
}
