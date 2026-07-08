"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMarca } from "@ruum/ui";

const DESTINOS = [
  {
    href: "/",
    etiqueta: "Dashboard",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: "/viajes",
    etiqueta: "Viajes",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <path d="M16 8h4l3 3v5h-7V8Z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    href: "/incidencias",
    etiqueta: "Alertas",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
        <path d="M12 9v4m0 4h.01"/>
      </svg>
    ),
  },
  {
    href: "/configuracion",
    etiqueta: "Ajustes",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
      </svg>
    ),
  },
] as const;

function esActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavegacionAdminMovil() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-mist/95 backdrop-blur supports-[backdrop-filter]:bg-mist/85 lg:hidden">
      <div className="ruum-container flex min-h-16 items-center justify-between gap-3 py-2.5">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Ir al dashboard de Ruum Ruum">
          <LogoMarca tamano={28} color="signal" />
          <span className="font-display text-sm font-extrabold tracking-tight text-ink">
            ruum<span className="text-signal">ruum</span>
          </span>
          <span className="font-mono-ruum text-[9px] uppercase tracking-[0.12em] text-ink/45">Control</span>
        </Link>
        <Link href="/viajes" className="inline-flex min-h-10 items-center rounded-lg bg-signal px-3 py-2 font-body text-xs font-bold text-ink shadow-sm">
          Ver viajes
        </Link>
      </div>
      <nav aria-label="Navegación principal móvil" className="ruum-container flex gap-1 overflow-x-auto pb-2.5">
        {DESTINOS.map((destino) => {
          const activo = esActivo(pathname, destino.href);
          return (
            <Link
              key={destino.href}
              href={destino.href}
              aria-current={activo ? "page" : undefined}
              className={[
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-body text-xs font-semibold",
                activo ? "bg-signal text-ink" : "border border-ink/10 bg-mist text-ink/60",
              ].join(" ")}
            >
              <destino.Icono />
              {destino.etiqueta}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
