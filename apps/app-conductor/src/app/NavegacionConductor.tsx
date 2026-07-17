"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { useViajeActivo } from "./ViajeActivoContext";
import { getTripPresentation } from "../lib/trip-presentation";

/* Íconos SVG inline — reemplazan los caracteres Unicode ⌂ ▤ $ ◌ */
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

const DESTINOS: { href: string; etiqueta: string; Icono: DestinoIcono }[] = [
  { href: "/panel", etiqueta: "Inicio", Icono: IcoHome },
  { href: "/viajes", etiqueta: "Viajes", Icono: IcoViajes },
  { href: "/ganancias", etiqueta: "Ganancias", Icono: IcoGanancias },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: IcoCuenta },
];

function esActivo(pathname: string, href: string) {
  if (href === "/panel") return pathname === "/panel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegación consistente para la operación del conductor. */
export function NavegacionConductor() {
  const pathname = usePathname();
  const { viajeActivo } = useViajeActivo();
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
      <header role="banner" className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="ruum-container flex min-h-16 items-center gap-3 py-3">
          <Link href="/panel" aria-label="Ir al inicio de Ruum Ruum Conductor" className="flex shrink-0 items-center gap-2.5 rounded-lg">
            <LogoMarca tamano={30} color="signal" />
            <span className="hidden font-display text-base font-extrabold tracking-tight text-text-primary sm:inline">
              ruum<span className="text-signal">ruum</span>
            </span>
            <span className="hidden font-body text-xs font-semibold text-text-tertiary lg:inline">Conductor</span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {DESTINOS.map((destino) => {
              const activo = esActivo(pathname, destino.href);
              return (
                <Link
                  key={destino.href}
                  href={destino.href}
                  aria-current={activo ? "page" : undefined}
                  className={[
                    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold",
                    activo ? "bg-action-primary text-text-primary shadow-sm" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
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

        {viajeActivo && (
          <div className="hidden border-t border-route-action bg-route-soft px-3 py-2 backdrop-blur md:block">
            <div className="ruum-container flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/viajes/${viajeActivo.trasladoId}`}
                className="min-w-0 rounded-xl px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action"
              >
                <p className="flex items-center gap-2 font-body text-sm font-semibold text-route-action">
                  <span>Viaje activo · {viajeActivo.folio}</span>
                  {hayAccionPendiente && (
                    <span className="rounded-full border border-warning bg-warn-soft px-2 py-0.5 font-body text-xs font-bold text-warning">
                      Acción pendiente
                    </span>
                  )}
                </p>
                <div className="mt-0.5 flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                  <span className="truncate font-body text-sm font-semibold text-text-primary">{viajeActivo.etapa}</span>
                  <span className="hidden text-text-tertiary sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="truncate font-body text-base text-text-secondary">{viajeActivo.destinoActual}</span>
                </div>
              </Link>
              <div className="grid grid-cols-4 gap-1 sm:flex sm:shrink-0 sm:items-center">
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-route-action px-3 py-2 text-center font-body text-sm font-bold text-surface"
                >
                  Abrir
                </Link>
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}#contacto`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-route-action bg-surface px-2 py-2 text-center font-body text-sm font-semibold text-route-action"
                >
                  Contacto
                </Link>
                <Link
                  href={`/viajes/${viajeActivo.trasladoId}#reportar-problema`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-route-action bg-surface px-2 py-2 text-center font-body text-sm font-semibold text-route-action"
                >
                  Incidencia
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

      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        {viajeActivo && (
          <div className="px-3 pb-2">
            <Link
              href={`/viajes/${viajeActivo.trasladoId}`}
              aria-label={`Abrir viaje activo ${viajeActivo.folio}: ${viajeActivo.etapa}`}
              className="mx-auto grid min-h-20 max-w-md grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-route-action bg-route-soft px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.38)] backdrop-blur"
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-body text-xs font-bold uppercase text-route-action">
                    Viaje activo · {viajeActivo.folio}
                  </span>
                  {hayAccionPendiente && (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-warning bg-warn-soft px-2 py-0.5 font-body text-[11px] font-bold text-warning">
                      Acción
                    </span>
                  )}
                </span>
                <span className="mt-1 block truncate font-body text-sm font-bold text-text-primary">{viajeActivo.etapa}</span>
                <span className="mt-0.5 block truncate font-body text-sm text-text-secondary">{viajeActivo.destinoActual}</span>
              </span>
              <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-route-action px-3 font-body text-sm font-bold text-surface">
                Abrir
              </span>
            </Link>
          </div>
        )}

        <nav
          aria-label="Navegación principal móvil"
          className="border-t border-border bg-surface/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"
        >
          <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {DESTINOS.map((destino) => {
            const activo = esActivo(pathname, destino.href);
            const notificar = destino.href === "/viajes" && hayAccionPendiente;
            return (
              <Link
                key={destino.href}
                href={destino.href}
                aria-current={activo ? "page" : undefined}
                aria-label={notificar ? `${destino.etiqueta}: acción pendiente en viaje activo` : destino.etiqueta}
                className={[
                  "relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 font-body text-xs font-semibold",
                  activo ? "bg-signal-soft text-text-primary" : "text-text-secondary"
                ].join(" ")}
              >
                {notificar && (
                  <span className="absolute right-3 top-2 size-2.5 rounded-full bg-warning ring-2 ring-surface" aria-hidden />
                )}
                <destino.Icono />
                <span className="max-w-full truncate">{destino.etiqueta}</span>
              </Link>
            );
          })}
          </div>
        </nav>
      </div>
    </>
  );
}
