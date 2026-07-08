"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMarca } from "@ruum/ui";

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
  { href: "/", etiqueta: "Inicio", Icono: IcoHome },
  { href: "/viajes", etiqueta: "Viajes", Icono: IcoViajes },
  { href: "/ganancias", etiqueta: "Ganancias", Icono: IcoGanancias },
  { href: "/configuracion", etiqueta: "Cuenta", Icono: IcoCuenta },
];

function esActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navegación consistente para la operación del conductor. */
export function NavegacionConductor() {
  const pathname = usePathname();
  const esAcceso = pathname === "/login" || pathname === "/registro";

  if (esAcceso) return null;

  return (
    <>
      <header role="banner" className="sticky top-0 z-30 border-b border-ink/10 bg-mist/95 backdrop-blur supports-[backdrop-filter]:bg-mist/85">
        <div className="ruum-container flex min-h-16 items-center gap-3 py-3">
          <Link href="/" aria-label="Ir al inicio de Ruum Ruum Conductor" className="flex shrink-0 items-center gap-2.5 rounded-lg">
            <LogoMarca tamano={30} color="signal" />
            <span className="hidden font-display text-base font-extrabold tracking-tight text-ink sm:inline">
              ruum<span className="text-signal">ruum</span>
            </span>
            <span className="hidden font-mono-ruum text-[10px] uppercase tracking-[0.14em] text-ink/45 lg:inline">Conductor</span>
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
                    "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold",
                    activo ? "bg-signal text-ink shadow-sm" : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink"
                  ].join(" ")}
                >
                  <destino.Icono />
                  {destino.etiqueta}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/viajes"
            className="ml-auto inline-flex min-h-11 items-center justify-center rounded-xl border border-route-dark bg-route-dark px-4 py-2.5 font-display text-sm font-bold text-mist shadow-sm transition hover:-translate-y-0.5 hover:bg-[#0a4b8c] hover:shadow-md"
          >
            Ver viajes
          </Link>
        </div>
      </header>

      <nav aria-label="Navegación principal móvil" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-mist/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {DESTINOS.map((destino) => {
            const activo = esActivo(pathname, destino.href);
            return (
              <Link
                key={destino.href}
                href={destino.href}
                aria-current={activo ? "page" : undefined}
                className={[
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 font-body text-[11px] font-semibold",
                  activo ? "bg-signal-soft text-ink" : "text-ink/55"
                ].join(" ")}
              >
                <destino.Icono />
                {destino.etiqueta}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
