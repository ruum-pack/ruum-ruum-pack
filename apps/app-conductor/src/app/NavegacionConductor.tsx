"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { useViajeActivo } from "./ViajeActivoContext";
import { getTripPresentation } from "../lib/trip-presentation";

/* Íconos SVG inline — actualizados para coincidir con la imagen premium */
function IcoGrid() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IcoTruck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM14 12v-2h3v2h-3z" />
    </svg>
  );
}

function IcoDollarCircle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3H9h4.5a1.5 1.5 0 0 1 0 3H9" />
    </svg>
  );
}

function IcoHome() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IcoViajes() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IcoGanancias() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M12 9v6m-3-3h6" />
    </svg>
  );
}

function IcoNotificaciones() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function IcoCuenta() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

type DestinoIcono = React.ComponentType;

const DESTINOS_ESCRITORIO: { href: string; etiqueta: string; Icono: DestinoIcono }[] = [
  { href: "/panel", etiqueta: "Inicio", Icono: IcoHome },
  { href: "/viajes", etiqueta: "Traslados", Icono: IcoViajes },
  { href: "/ganancias", etiqueta: "Ganancias", Icono: IcoGanancias },
  { href: "/notificaciones", etiqueta: "Notificaciones", Icono: IcoNotificaciones },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: IcoCuenta },
];

const DESTINOS_MOVIL = [
  { href: "/panel", etiqueta: "Inicio", Icono: IcoHome },
  { href: "/viajes", etiqueta: "Traslados", Icono: IcoViajes },
  { href: "/ganancias", etiqueta: "Ganancias", Icono: IcoGanancias },
  { href: "/notificaciones", etiqueta: "Notificaciones", Icono: IcoNotificaciones },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: IcoCuenta },
];

function esActivo(pathname: string, href: string) {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegación consistente para la operación del conductor. */
export function NavegacionConductor() {
  const pathname = usePathname();
  const { viajeActivo, viajeActivoSinActualizar } = useViajeActivo();
  const esAcceso = pathname === "/login" || pathname === "/registro" || pathname === "/onboarding";
  const presentacionViajeActivo = viajeActivo ? getTripPresentation(viajeActivo.estado) : null;
  const hayAccionPendiente = Boolean(presentacionViajeActivo && presentacionViajeActivo.primaryAction.action !== "none");

  useEffect(() => {
    document.body.classList.toggle("conductor-tiene-viaje-activo", Boolean(viajeActivo));
    return () => document.body.classList.remove("conductor-tiene-viaje-activo");
  }, [viajeActivo]);

  if (esAcceso) return null;

  return (
    <>
      {/* Ocultar encabezado global en pantallas móviles para dar un look nativo y limpio */}
      <header role="banner" className="hidden md:block sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="ruum-container flex min-h-16 items-center gap-3 py-3">
          <Link href="/panel" aria-label="Ir al inicio de Ruum Ruum Conductor" className="flex shrink-0 items-center gap-2.5 rounded-lg">
            <LogoMarca variante="horizontal" tema="auto" tamano={30} mostrarDescriptor={false} mostrarRespaldo={false} />
            <span className="hidden font-body text-xs font-semibold text-text-tertiary lg:inline">Conductor</span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {DESTINOS_ESCRITORIO.map((destino) => {
              const activo = esActivo(pathname, destino.href);
              return (
                <Link
                  key={destino.href}
                  href={destino.href}
                  prefetch={!activo}
                  aria-current={activo ? "page" : undefined}
                  aria-label={activo ? `Página actual: ${destino.etiqueta}` : destino.etiqueta}
                  className={[
                    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold",
                    activo ? "bg-action-primary text-on-primary shadow-sm" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                  ].join(" ")}
                >
                  <destino.Icono />
                  {destino.etiqueta}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto" aria-hidden />
        </div>

        {viajeActivo && !pathname.startsWith("/viajes") && pathname !== "/panel" && (
          <div className="hidden border-t border-border bg-surface-elevated/95 px-3 py-2 backdrop-blur md:block">
            <div className="ruum-container flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/viajes/${viajeActivo.trasladoId}`}
                className="min-w-0 rounded-xl px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
                aria-label={`Ver detalles del traslado ${viajeActivo.folio}`}
              >
                <p className="flex items-center gap-2 font-body text-sm font-semibold text-route-action">
                  <span>Traslado activo · {viajeActivo.folio}</span>
                  {hayAccionPendiente && (
                    <span className="rounded-full border border-warning bg-warning px-2 py-0.5 font-body text-sm font-bold text-on-primary">
                      Acción pendiente
                    </span>
                  )}
                  {viajeActivoSinActualizar && (
                    <span className="rounded-full border border-warning bg-warning/10 px-2 py-0.5 font-body text-sm font-bold text-warning">
                      Información sin actualizar
                    </span>
                  )}
                </p>
                <div className="mt-0.5 flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="truncate font-body text-sm font-semibold text-text-primary">{viajeActivo.etapa}</span>
                  <span className="hidden text-text-secondary sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="truncate font-body text-base text-text-secondary">{viajeActivo.destinoActual}</span>
                </div>
              </Link>
              <div className="grid grid-cols-4 gap-1 sm:flex sm:shrink-0 sm:items-center">
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-route-action px-3 py-2 text-center font-body text-sm font-bold text-white"
                >
                  Abrir
                </Link>
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}#contacto`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[rgba(142,197,255,0.42)] bg-surface px-2 py-2 text-center font-body text-sm font-semibold text-text-primary"
                >
                  Contacto
                </Link>
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}#reportar-problema`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[rgba(142,197,255,0.42)] bg-surface px-2 py-2 text-center font-body text-sm font-semibold text-text-primary"
                >
                  Problema
                </Link>
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}#emergencia`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-danger-action bg-danger-soft px-2 py-2 text-center font-body text-sm font-semibold text-danger-action"
                >
                  Emergencia
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Navegación móvil fija al fondo adaptada al Brand Book */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-surface/95 border-t border-border/20 backdrop-blur-md pb-[max(8px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] supports-[backdrop-filter]:bg-surface/80">
        
        {/* Banner de viaje activo en móvil: flotante arriba de la barra fija */}
        {viajeActivo && !pathname.startsWith("/viajes") && pathname !== "/panel" && (
          <div className="conductor-mobile-active-trip px-4 pb-3">
            <Link
              href={`/viajes/${viajeActivo.trasladoId}`}
              aria-label={`Abrir traslado activo ${viajeActivo.folio}: ${viajeActivo.etapa}`}
              className="conductor-mobile-active-trip-card mx-auto grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-border/40 bg-surface-elevated/95 px-4 py-2.5 shadow-lg backdrop-blur"
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-body text-xs font-bold uppercase text-route-action">
                    Traslado activo · {viajeActivo.folio}
                  </span>
                  {hayAccionPendiente && (
                    <span className="inline-flex size-3 shrink-0 rounded-full bg-warning ring-2 ring-surface-elevated" aria-hidden />
                  )}
                </span>
                <span className="mt-1 block truncate font-body text-sm font-bold text-text-primary">{viajeActivo.etapa}</span>
                <span className="conductor-mobile-active-trip-destination mt-0.5 block truncate font-body text-xs text-text-secondary">{viajeActivo.destinoActual}</span>
              </span>
              <span className="inline-flex min-h-10 items-center justify-center rounded-xl bg-signal px-3.5 font-display text-xs font-black text-slate-950 shadow-xs uppercase">
                Abrir
              </span>
            </Link>
          </div>
        )}

        <nav aria-label="Navegación principal móvil" className="w-full px-1 max-w-md mx-auto">
          <div className="grid grid-cols-5 gap-0.5">
            {DESTINOS_MOVIL.map((destino) => {
              const activo = esActivo(pathname, destino.href);
              const notificar = destino.href === "/viajes" && hayAccionPendiente;
              
              return (
                <Link
                  key={destino.href}
                  href={destino.href}
                  prefetch={!activo}
                  aria-current={activo ? "page" : undefined}
                  aria-label={notificar ? `${destino.etiqueta}: acción pendiente` : destino.etiqueta}
                  className={[
                    "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 min-h-[56px] font-body text-[10px] leading-none transition-colors duration-200 select-none",
                    activo ? "text-text-primary dark:text-signal font-black bg-signal/20 dark:bg-signal/15 shadow-2xs" : "text-text-secondary hover:text-text-primary"
                  ].join(" ")}
                >
                  <div className="relative flex items-center justify-center p-1">
                    {notificar && (
                      <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-warning ring-2 ring-surface animate-pulse" aria-hidden />
                    )}
                    <destino.Icono />
                  </div>
                  <span className="max-w-full truncate tracking-tight text-[10px] leading-none">{destino.etiqueta}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}

