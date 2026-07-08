import Link from "next/link";
import type { Database } from "@ruum/shared/types";
import { NavegacionUsuario } from "./NavegacionUsuario";
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
      <main className="app-page">
        <NavegacionUsuario />
        <div className="app-container py-10 sm:py-14">
          <InicioUsuario usuario={usuario} traslados={traslados} />
        </div>
      </main>
    );
  }

  // Sin sesión: entrada móvil pública alineada con el onboarding.
  return (
    <PantallaPublica>
      <section className="relative flex min-h-screen flex-col overflow-hidden px-5 pb-10 pt-14">
        <LogoRuum className="mx-auto text-center" />

        <div className="pointer-events-none absolute inset-x-0 top-[118px] h-[430px] overflow-hidden">
          <img
            src="/imagenes/seguridad-traslado.png"
            alt="Traslado vehicular protegido con verificacion de identidad"
            className="h-full w-full scale-[1.12] object-cover object-[39%_50%]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_18%,rgba(245,166,35,0.12),transparent_38%),linear-gradient(180deg,rgba(7,18,38,0)_52%,#1a1f2e_94%)]" />
          <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#1a1f2e] to-transparent" />
          <div className="absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#1a1f2e] to-transparent" />
        </div>

        <div className="relative z-10 mt-auto">
          <h1 className="font-display text-[23px] font-extrabold leading-[1.05] tracking-normal text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
            Bienvenido
          </h1>
          <p className="mt-2 font-body text-xs leading-5 text-[#d4d9e2]">Inicia sesión para continuar</p>

          <div className="mt-5 grid gap-2.5">
            <Link href="/login" className={botonAzul}>
              Conecta con tu cuenta
            </Link>
            <Link href="/registro" className={botonContorno}>
              Crea tu cuenta
            </Link>
          </div>
        </div>
      </section>
    </PantallaPublica>
  );
}
