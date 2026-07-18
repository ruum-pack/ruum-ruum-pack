"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMarca } from "@ruum/ui";

const DESTINOS = [
  {
    href: "/viajes",
    etiqueta: "Traslados",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <path d="M16 8h4l3 3v5h-7V8Z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    href: "/masivos",
    etiqueta: "Masivos",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h16v5H4z"/><path d="M4 15h16v5H4z"/><path d="M8 9v6M16 9v6"/><path d="M8 6h.01M8 17h.01"/>
      </svg>
    ),
  },
  {
    href: "/conductores",
    etiqueta: "Conductores",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M16 11l2 2 4-4" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    href: "/usuarios",
    etiqueta: "Usuarios",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    href: "/vehiculos",
    etiqueta: "Vehículos",
    Icono: () => (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5"/><path d="M5 13h14a2 2 0 0 1 2 2v3h-3"/><path d="M6 18H3v-3a2 2 0 0 1 2-2"/><circle cx="7.5" cy="18" r="2"/><circle cx="16.5" cy="18" r="2"/><path d="M8 10h8"/>
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
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface-primary/95 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/85 lg:hidden">
      <div className="ruum-container flex min-h-16 items-center justify-between gap-3 py-2.5">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Ir al dashboard de Ruum Ruum">
          <LogoMarca tamano={28} color="signal" />
          <span className="font-display text-sm font-extrabold tracking-tight text-ink">
            ruum<span className="text-signal">ruum</span>
          </span>
          <span className="font-mono-ruum text-[9px] uppercase tracking-[0.12em] text-text-tertiary">Control</span>
        </Link>
        <Link href="/viajes" className="inline-flex min-h-10 items-center rounded-lg bg-signal px-3 py-2 font-body text-xs font-bold text-ink shadow-sm">
          Ver traslados
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
                activo ? "bg-signal text-ink" : "border border-ink/10 bg-surface-primary text-text-secondary",
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
