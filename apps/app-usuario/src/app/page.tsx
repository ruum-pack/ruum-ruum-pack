import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { Database } from "@ruum/shared/types";
import { IDENTIDAD_MARCA } from "@ruum/shared/constants";
import { LogoMarca, SelloConductor } from "@ruum/ui";
import { NavegacionUsuario } from "./NavegacionUsuario";
import { InicioUsuario } from "./InicioUsuario";
import { obtenerViajeActivo } from "../lib/inicio";
import { botonAzul, botonContorno } from "./experiencia-publica";

type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

interface ContextoSesion {
  usuario: UsuarioRow | null;
  traslados: PasaporteRow[];
  conductorFotoUrl: string | null;
  error?: string | null;
}

async function obtenerContextoSesion(): Promise<ContextoSesion> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { usuario: null, traslados: [], conductorFotoUrl: null, error: "config_error" };

  try {
    const { crearClienteServidor } = await import("../lib/supabase-server");
    const { obtenerUsuarioActual, listarTrasladosDeUsuario } = await import("@ruum/api/services");
    const { obtenerFotoPerfilConductor } = await import("@ruum/api/drivers");

    const cliente = await crearClienteServidor();
    const usuario = await obtenerUsuarioActual(cliente);
    if (!usuario) return { usuario: null, traslados: [], conductorFotoUrl: null };

    const traslados = await listarTrasladosDeUsuario(cliente, usuario.id);
    const viajeActivo = obtenerViajeActivo(traslados);
    let conductorFotoUrl: string | null = null;

    if (viajeActivo?.conductor_id) {
      try {
        conductorFotoUrl = await obtenerFotoPerfilConductor(cliente, viajeActivo.conductor_id);
      } catch (error) {
        console.warn("[app-usuario:obtenerContextoSesion] conductor_photo_unavailable", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { usuario, traslados, conductorFotoUrl, error: null };
  } catch (err) {
    console.error("[app-usuario:obtenerContextoSesion] supabase_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { usuario: null, traslados: [], conductorFotoUrl: null, error: "supabase_error" };
  }
}

export default async function PaginaInicio({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const { usuario, traslados, conductorFotoUrl, error } = await obtenerContextoSesion();
  const forzarLanding = params.landing === "true";

  // C-08: no silenciar error de Supabase — mostrar Aviso en lugar de landing/redirect confuso
  if (error && !usuario) {
    const esConfigError = error === "config_error";
    return (
      <main className="user-v2-scope user-v2-page">
        <NavegacionUsuario variante="claro" />
        <div className="user-v2-content">
          <div className="user-v2-card p-6 text-center" role="alert" aria-live="assertive">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--user-color-error)]">
              {esConfigError ? "Servicio no configurado" : "No pudimos verificar tu sesión"}
            </p>
            <h1 className="mt-2 font-display text-xl font-bold text-[var(--user-color-primary)]">
              {esConfigError ? "Configuración incompleta" : "Error temporal de conexión"}
            </h1>
            <p className="mt-2 font-body text-sm leading-6 text-[var(--user-color-muted)]">
              {esConfigError
                ? "Falta configuración de Supabase. Contacta a soporte si ves este mensaje en producción."
                : "No pudimos cargar tu sesión por un error de red. Tus datos siguen seguros; intenta recargar o inicia sesión de nuevo."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/"
                className="user-v2-primary-button inline-flex items-center justify-center px-6"
              >
                Reintentar
              </Link>
              <Link
                href="/login"
                className="user-v2-secondary-button inline-flex items-center justify-center px-6"
              >
                Ir a iniciar sesión
              </Link>
            </div>
            <p className="mt-4 font-body text-xs text-[var(--user-color-muted)]">
              Si el problema persiste, <Link href="/soporte" className="underline hover:text-[var(--user-color-primary)]">contacta a soporte</Link>.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (usuario && !forzarLanding) {
    return (
      <main className="user-v2-scope user-v2-page">
        <NavegacionUsuario variante="claro" />
        <div className="user-v2-content">
          <InicioUsuario usuario={usuario} traslados={traslados} conductorFotoUrl={conductorFotoUrl} />
        </div>
      </main>
    );
  }

  // Si no hay sesión activa y no se solicitó la landing explícitamente (?landing=true),
  // redirigir directamente al inicio de sesión (/login)
  if (!forzarLanding) {
    redirect("/login");
  }

  // Experiencia Pública / Landing (Libro de Marca V2.1 cap. 32)
  return (
    <div className="min-h-screen bg-[var(--ruum-navy)] text-white">
      {/* Barra de Navegación Pública */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--ruum-navy)]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <LogoMarca variante="horizontal" tema="oscuro" tamano={34} />
          <div className="flex items-center gap-3">
            <Link
              href="#como-funciona"
              className="hidden sm:inline-flex rounded-lg px-3 py-2 font-body text-xs font-semibold text-[#A9BCD3] transition hover:text-white"
            >
              Cómo funciona
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 font-body text-xs font-semibold text-white transition hover:text-[var(--ruum-teal)]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="ruum-button-primary rounded-[14px] px-4 py-2 font-body text-xs font-semibold text-white shadow-sm transition"
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
          <div className="absolute inset-0 bg-[var(--ruum-navy)]/60" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ruum-teal)]/40 bg-[var(--ruum-teal)]/10 px-3.5 py-1 text-xs font-semibold text-[var(--ruum-teal)] mb-6">
            <span className="size-2 rounded-full bg-[var(--ruum-teal)] animate-pulse" />
            Traslado vehicular con conductores certificados
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Seguridad, evidencia y trazabilidad en cada viaje.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl font-body text-base text-[#C7D5E7] sm:text-lg">
            Sabes quién lleva tu auto y qué evidencia queda de cada etapa: conductores certificados,
            evidencia documentada y seguimiento durante el trayecto.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registro" className={`sm:w-auto ${botonAzul} sm:px-8`}>
              Crear cuenta y cotizar
            </Link>
            <Link href="#como-funciona" className={`sm:w-auto ${botonContorno} sm:px-8`}>
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
              <span className="font-body text-xs font-bold uppercase tracking-wider text-[var(--ruum-teal)]">
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
                <SelloConductor compacto tema="certificado" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <h3 className="font-display text-lg font-bold text-[var(--ruum-teal)]">
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
      <section id="como-funciona" className="border-b border-white/10 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--ruum-teal)]">
              Protocolo Operativo
            </span>
            <h2 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
              ¿Cómo funciona cada traslado?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl font-body text-sm text-[#C7D5E7]">
              Cada traslado tiene folio, ruta y evidencia: tres pasos visibles de principio a fin.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IDENTIDAD_MARCA.pasosProtocolo.map((item) => (
              <div
                key={item.paso}
                className="relative rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-[var(--ruum-teal)]/50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--ruum-teal-deep)] font-display text-sm font-black text-white">
                    {item.paso}
                  </span>
                  <span className="font-mono-ruum text-xs text-[#A9BCD3]">FASE {item.paso}</span>
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
            <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--ruum-teal)]">
              Ventajas Ruum Ruum
            </span>
            <h2 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl">
              Diferenciadores Clave
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IDENTIDAD_MARCA.diferenciadores.map((dif, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--ruum-teal)]/15 text-[var(--ruum-teal)]">
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
            <div className="rounded-xl border border-[var(--ruum-teal)]/30 bg-[var(--ruum-teal)]/10 p-5 flex flex-col justify-center">
              <h3 className="font-display text-base font-bold text-[var(--ruum-teal)]">
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
          <SelloConductor tamano="md" tema="certificado" className="mx-auto mb-6" />
          <h2 className="font-display text-2xl font-black text-white sm:text-3xl">
            Sabes quién lleva tu auto y qué evidencia queda de cada etapa.
          </h2>
          <p className="mt-4 font-body text-sm leading-relaxed text-[#B7C2D4] sm:text-base">
            {IDENTIDAD_MARCA.manifiesto}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/registro" className={`sm:w-auto ${botonAzul} sm:px-8`}>
              Comenzar ahora
            </Link>
            <Link href="/login" className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center rounded-lg px-5 py-3 font-display text-sm font-semibold text-[#8B98AD] transition hover:text-white">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* EVIDENCIA (cap. 28: el reporte es la prueba visible) */}
      <section className="border-t border-white/10 bg-white px-4 py-16 text-[var(--ruum-navy)] sm:px-6 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center font-body text-xs font-bold uppercase tracking-wider text-[var(--ruum-teal-deep)]">
            Evidencia
          </p>
          <h2 className="mt-2 text-center font-body text-2xl font-bold sm:text-3xl">
            Cada traslado deja reporte, folio y firma
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center font-body text-sm text-[var(--ruum-muted)]">
            Ejemplo ilustrativo con datos ficticios. El cliente recibe este paquete al cierre.
          </p>
          <dl className="mx-auto mt-8 grid max-w-3xl gap-4 rounded-[20px] border border-[var(--ruum-border)] bg-[var(--ruum-neutral-bg)] p-5 sm:grid-cols-2">
            <div><dt className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">Folio</dt><dd className="font-body text-sm font-bold tabular-nums">RR-2026-0001</dd></div>
            <div><dt className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">Ruta</dt><dd className="font-body text-sm">CDMX → Toluca</dd></div>
            <div><dt className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">Conductor</dt><dd className="font-body text-sm">Conductor certificado · Nivel 2</dd></div>
            <div><dt className="font-body text-xs font-semibold uppercase tracking-wider text-[var(--ruum-teal-deep)]">Evidencia</dt><dd className="font-body text-sm">Fotos, odómetro, combustible y firma al recoger y entregar</dd></div>
          </dl>
        </div>
      </section>

      {/* FORMULARIO B2B (cap. 29: usted, formal, solo promesas verificables) */}
      <section id="empresas" className="border-t border-white/10 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-body text-xs font-bold uppercase tracking-wider text-[var(--ruum-teal)]">Empresas</p>
          <h2 className="mt-2 font-body text-2xl font-bold text-white sm:text-3xl">
            Cada unidad, documentada de origen a destino
          </h2>
          <p className="mx-auto mt-3 max-w-2xl font-body text-sm text-[#C7D5E7]">
            Solicite su propuesta. Le respondemos con alcance, duración y siguiente paso.
          </p>
          <form
            className="mx-auto mt-8 grid max-w-xl gap-3 rounded-[20px] border border-white/10 bg-white/5 p-5 text-left"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="font-body text-[13px] font-semibold text-white" htmlFor="b2b-nombre">Nombre y empresa</label>
            <input id="b2b-nombre" name="nombre" required autoComplete="name" className="min-h-[48px] rounded-[12px] border border-white/20 bg-white px-3.5 py-2.5 font-body text-base text-[var(--ruum-navy)]" />
            <label className="font-body text-[13px] font-semibold text-white" htmlFor="b2b-correo">Correo de trabajo</label>
            <input id="b2b-correo" name="correo" type="email" required autoComplete="email" className="min-h-[48px] rounded-[12px] border border-white/20 bg-white px-3.5 py-2.5 font-body text-base text-[var(--ruum-navy)]" />
            <label className="font-body text-[13px] font-semibold text-white" htmlFor="b2b-mensaje">¿Qué necesita mover?</label>
            <textarea id="b2b-mensaje" name="mensaje" rows={3} className="min-h-[112px] rounded-[12px] border border-white/20 bg-white px-3.5 py-2.5 font-body text-base text-[var(--ruum-navy)]" />
            <button type="submit" className="ruum-button-primary mt-2 inline-flex min-h-[52px] items-center justify-center rounded-[14px] px-6 font-body text-base font-semibold text-white">
              Solicitar propuesta
            </button>
          </form>
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
            <Link href="#como-funciona" className="transition hover:text-white">
              Cómo funciona
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
