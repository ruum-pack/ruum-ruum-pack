import Link from "next/link";
import { Button, LogoMarca } from "@ruum/ui";
import type { Database } from "@ruum/shared/types";
import { PILARES_CONFIANZA } from "../lib/pilares-confianza";
import { BotonCerrarSesion } from "./BotonCerrarSesion";
import { InicioUsuario } from "./InicioUsuario";

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
          <span className="flex items-center gap-2">
            <LogoMarca tamano={24} color="route" />
            <span className="font-display text-lg font-semibold tracking-tight">Ruum Ruum</span>
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

  // Sin sesión: landing pública con los pilares de confianza del producto.
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
      <header className="mb-16 flex items-center justify-between">
        <span className="flex items-center gap-2">
            <LogoMarca tamano={24} color="route" />
            <span className="font-display text-lg font-semibold tracking-tight">Ruum Ruum</span>
          </span>
        <div className="flex items-center gap-5">
         <Link href="/soporte" className="font-body text-sm font-medium text-ink/70 hover:text-ink">
            ¿Necesitas ayuda?
          </Link>
        </div>
      </header>
        <section className="grid gap-12 sm:grid-cols-[1.1fr_0.9fr] sm:items-center">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Tu vehículo, documentado en cada kilómetro.
          </h1>
          <p className="mt-5 max-w-md font-body text-base text-ink/65">
            Conductores certificados, evidencia fotográfica de inicio a fin y un Pasaporte Digital con todo el
            historial de tu traslado. Sabes dónde está tu vehículo y qué le pasó.
          </p>
         
        </div>

        <div className="rounded-lg border border-ink/10 bg-mist p-6">
          <p className="font-body text-xs uppercase tracking-wide text-ink/45">Primer paso</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Crea una cuenta verificada</h2>
          <p className="mt-3 font-body text-sm leading-6 text-ink/60">
            Captura tus datos, sube tu identificación y solicita traslados reales desde tu cuenta.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-16">
            <Link href="/registro">
              <Button>Crear mi cuenta</Button>
            </Link>
            <Link href="/login">
              <Button>Iniciar sesión</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-24 grid gap-8 sm:grid-cols-3">
        {PILARES_CONFIANZA.map((pilar) => (
          <div key={pilar.titulo}>
            <h2 className="font-display text-base font-semibold">{pilar.titulo}</h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-ink/60">{pilar.cuerpo}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
