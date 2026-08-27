"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Íconos SVG exactos a la imagen de referencia */
function IconoHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconoTraslados({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="1" y="4" width="14" height="12" rx="1.5" />
      <path d="M15 8h4l3 3.5V16h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconoAyuda({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function IconoCuenta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" />
    </svg>
  );
}

const DESTINOS = [
  { href: "/", etiqueta: "Inicio", Icono: IconoHome },
  { href: "/mis-viajes", etiqueta: "Traslados", Icono: IconoTraslados },
  { href: "/soporte", etiqueta: "Ayuda", Icono: IconoAyuda },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: IconoCuenta },
] as const;

function estaActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavegacionUsuario() {
  const pathname = usePathname();
  const esAcceso = pathname === "/login" || pathname === "/registro" || pathname === "/onboarding";

  if (esAcceso) return null;

  return (
    <>
      {/* 1. Cabecera Superior (Top App Bar) */}
      <header role="banner" className="sticky top-0 z-30 w-full bg-[#070D18]/90 backdrop-blur-md pt-[env(safe-area-inset-top)] border-b border-[#1C2A3E]/40">
        <div className="w-full max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo Ruum Ruum Usuario */}
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#151515] border-2 border-[#FFC400] shadow-sm">
              <svg className="size-6 text-[#FFC400]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H8c-.7 0-1.3.3-1.8.7C5.3 8.6 4 10 4 10s-2.7.6-4.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-base font-extrabold tracking-tight text-white">Ruum</span>
                <span className="font-display text-base font-extrabold tracking-tight text-[#FFC400]">Ruum</span>
              </div>
              <span className="font-body text-xs text-[#8E9CAE] font-normal">Usuario</span>
            </div>
          </Link>

          {/* Iconos de la derecha: Campana (con badge 2) y Avatar */}
          <div className="flex items-center gap-3">
            <Link
              href="/soporte"
              className="relative flex size-9 items-center justify-center text-slate-200 transition hover:text-white"
              aria-label="Notificaciones (2 pendientes)"
            >
              <svg className="size-6 text-[#CBD5E1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#FFC400] text-[10px] font-black text-slate-950 shadow-sm">
                2
              </span>
            </Link>

            <Link
              href="/cuenta"
              className="flex size-9 items-center justify-center rounded-full border border-slate-600/80 text-slate-300 transition hover:border-[#FFC400] hover:text-white"
              aria-label="Mi Cuenta"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegación Inferior (4 Tabs con Indicador Amarillo Activo) */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#070D18]/95 border-t border-[#1C2A3E]/60 backdrop-blur-md pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.6)]"
      >
        <div className="w-full max-w-md mx-auto px-2">
          <div className="grid grid-cols-4 items-center">
            {DESTINOS.map((destino) => {
              const activo = estaActivo(pathname, destino.href);

              return (
                <Link
                  key={destino.href}
                  href={destino.href}
                  aria-current={activo ? "page" : undefined}
                  className="relative flex flex-col items-center justify-center gap-1 py-1.5 select-none transition-colors group"
                >
                  {/* Línea horizontal amarilla sobre el tab activo */}
                  {activo && (
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-12 h-[3px] rounded-full bg-[#FFC400]" />
                  )}

                  <div className="relative flex items-center justify-center size-6">
                    <destino.Icono
                      className={`size-6 transition-colors ${
                        activo ? "text-[#FFC400]" : "text-[#8E9CAE] group-hover:text-white"
                      }`}
                    />
                  </div>

                  <span
                    className={`font-body text-[11px] leading-none tracking-tight transition-colors ${
                      activo
                        ? "font-bold text-[#FFC400]"
                        : "font-medium text-[#8E9CAE] group-hover:text-white"
                    }`}
                  >
                    {destino.etiqueta}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

