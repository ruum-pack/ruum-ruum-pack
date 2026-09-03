import Link from "next/link";
import Image from "next/image";
import type { Database } from "@ruum/shared/types";
import { IDENTIDAD_MARCA } from "@ruum/shared/constants";
import { LogoMarca, SelloConductor } from "@ruum/ui";
import { NavegacionUsuario } from "./NavegacionUsuario";
import { InicioUsuario } from "./InicioUsuario";
import { botonAzul, botonContorno } from "./experiencia-publica";

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
  } catch (err) {
    console.error("[app-usuario:obtenerContextoSesion] supabase_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { usuario: null, traslados: [] };
  }
}

export default async function PaginaInicio({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const { usuario, traslados } = await obtenerContextoSesion();
  const forzarLanding = params.landing === "true";

  if (usuario && !forzarLanding) {
    return (
      <main className="min-h-screen bg-[#F6F8FB] text-[#0D2B5E]">
        <NavegacionUsuario variante="claro" />
        <div className="mx-auto w-full max-w-[430px] px-4 py-2">
          <InicioUsuario usuario={usuario} traslados={traslados} />
        </div>
      </main>
    );
  }

  // Experiencia Pública / Landing Page Inicial (Brand Book Ruum Ruum V1 · Página 28)
  return (
    <div className="min-h-screen bg-[#151515] text-[#F8F8F5]">
      {/* Barra de Navegación Pública */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#151515]/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <LogoMarca variante="horizontal" tema="oscuro" tamano={34} />
          <div className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="hidden sm:inline-flex rounded-lg px-3 py-2 font-display text-xs font-semibold text-[#8B98AD] transition hover:text-white"
            >
              Cómo funciona
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 font-display text-xs font-semibold text-[#F8F8F5] transition hover:text-[#FFC400]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-[#FFC400] px-4 py-2 font-display text-xs font-bold text-[#151515] shadow-sm transition hover:bg-[#e0ac00]"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* 1. PORTADA / HERO (Páginas 1 & 28) */}
      <section className="relative overflow-hidden border-b border-white/10 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <Image
            src="/imagenes/seguridad-traslado.png"
            alt="Traslado vehicular con conductores certificados"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-[#151515]/70 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFC400]/40 bg-[#FFC400]/10 px-3.5 py-1 text-xs font-semibold text-[#FFC400] mb-6">
            <span className="size-2 rounded-full bg-[#FFC400] animate-pulse" />
            Traslado vehicular con conductores certificados
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Seguridad, evidencia y trazabilidad en cada viaje.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl font-body text-base text-[#B7C2D4] sm:text-lg">
            No movemos vehículos a ciegas. Cuidamos tu vehículo antes, durante y después del traslado
            mediante conductores certificados, evidencia documentada y seguimiento en tiempo real.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registro" className={`sm:w-auto ${botonAzul} sm:px-8`}>
              Crear cuenta y cotizar
            </Link>
            <Link href="/onboarding" className={`sm:w-auto ${botonContorno} sm:px-8`}>
              Conoce el servicio
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-lg px-5 py-3 font-display text-sm font-semibold text-[#8B98AD] transition hover:text-white"
            >
              Iniciar sesión →
            </Link>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 font-mono-ruum text-xs uppercase tracking-widest text-[#5F6368]">
            <span>by MoviliaX</span>
            <span>•</span>
            <span>Cobertura Local y Foránea</span>
          </div>
        </div>
      </section>

      {/* 2. QUÉ HACEMOS (Página 28) */}
      <section className="border-b border-white/10 bg-[#121721] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <span className="font-display text-xs font-bold uppercase tracking-wider text-[#FFC400]">
                Esencia de marca
              </span>
              <h2 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
                ¿Qué es Ruum Ruum?
              </h2>
              <p className="mt-4 font-body text-sm leading-relaxed text-[#B7C2D4] sm:text-base">
                {IDENTIDAD_MARCA.esencia.queEs}
              </p>
              <p className="mt-4 font-body text-sm leading-relaxed text-[#8B98AD]">
                Muchas personas entregan su vehículo sin suficiente información, sin evidencia y sin
                claridad sobre quién lo conduce. Ruum Ruum convierte el traslado vehicular en un proceso profesional documentado.
              </p>
              <div className="mt-6">
                <SelloConductor compacto tema="dorado" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#151515] p-6 shadow-xl">
              <h3 className="font-display text-lg font-bold text-[#FFC400]">
                Idea Central
              </h3>
              <p className="mt-2 font-display text-xl font-bold text-white">
                “No movemos vehículos a ciegas. Movemos vehículos con seguridad, evidencia y trazabilidad.”
              </p>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="font-body text-xs text-[#B7C2D4]">
                  Diseñado para particulares, agencias automotrices, talleres mecánicos, flotillas y corporativos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CÓMO FUNCIONA (Protocolo Operativo de 6 Pasos · Página 28) */}
      <section className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-[#FFC400]">
              Protocolo Operativo
            </span>
            <h2 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
              ¿Cómo funciona cada traslado?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl font-body text-sm text-[#B7C2D4]">
              Cada viaje cumple un protocolo riguroso de principio a fin, garantizando evidencia y trazabilidad.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IDENTIDAD_MARCA.pasosProtocolo.map((item) => (
              <div
                key={item.paso}
                className="relative rounded-xl border border-white/10 bg-[#151b26] p-5 transition hover:border-[#FFC400]/50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#FFC400] font-display text-sm font-black text-[#151515]">
                    {item.paso}
                  </span>
                  <span className="font-mono-ruum text-[10px] text-[#5F6368]">FASE {item.paso}</span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-white">
                  {item.titulo}
                </h3>
                <p className="mt-2 font-body text-xs leading-relaxed text-[#B7C2D4]">
                  {item.descripcion}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. DIFERENCIADORES CLAVE (Páginas 4 & 28) */}
      <section className="border-b border-white/10 bg-[#121721] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-[#FFC400]">
              Ventajas Ruum Ruum
            </span>
            <h2 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
              Diferenciadores Clave
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IDENTIDAD_MARCA.diferenciadores.map((dif, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-[#151515] p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#FFC400]/15 text-[#FFC400]">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-white">
                  {dif.titulo}
                </h3>
                <p className="mt-2 font-body text-xs leading-relaxed text-[#B7C2D4]">
                  {dif.descripcion}
                </p>
              </div>
            ))}
            <div className="rounded-xl border border-[#FFC400]/30 bg-[#FFC400]/10 p-5 flex flex-col justify-center">
              <h3 className="font-display text-base font-bold text-[#FFC400]">
                Atención y Cotización
              </h3>
              <p className="mt-2 font-body text-xs text-[#F8F8F5]">
                Soporte por canales autorizados y WhatsApp Business con catálogo de servicios inmediato.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. MANIFIESTO Y CIERRE INSTITUCIONAL (Páginas 35 & 36) */}
      <section className="px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <SelloConductor tamano="md" tema="dorado" className="mx-auto mb-6" />
          <h2 className="font-display text-2xl font-black text-white sm:text-3xl">
            No entregues tu auto a ciegas. Un traslado serio deja evidencia.
          </h2>
          <p className="mt-4 font-body text-sm leading-relaxed text-[#B7C2D4] sm:text-base">
            {IDENTIDAD_MARCA.manifiesto}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registro" className={`sm:w-auto ${botonAzul} sm:px-8`}>
              Comenzar ahora
            </Link>
            <Link href="/onboarding" className={`sm:w-auto ${botonContorno} sm:px-8`}>
              Ver recorrido de onboarding
            </Link>
            <Link href="/login" className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-lg px-5 py-3 font-display text-sm font-semibold text-[#8B98AD] transition hover:text-white">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#0d1117] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <LogoMarca variante="horizontal" tema="oscuro" tamano={28} />
            <p className="mt-2 font-body text-xs text-[#5F6368]">
              {IDENTIDAD_MARCA.lema}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 font-body text-xs text-[#8B98AD]">
            <Link href="/onboarding" className="transition hover:text-white">
              Cómo funciona (Onboarding)
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="transition hover:text-white">
              Crear cuenta
            </Link>
            <Link href="/legal/terminos" className="transition hover:text-white">
              Términos y condiciones
            </Link>
            <Link href="/legal/privacidad" className="transition hover:text-white">
              Aviso de privacidad
            </Link>
            <Link href="/soporte" className="transition hover:text-white">
              Ayuda y soporte
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
