"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BotonCerrarSesion } from "./BotonCerrarSesion";

type VarianteNavegacion = "claro" | "oscuro";

function IconoLogoUsuario() {
  return (
    <svg className="user-v2-logo-mark" viewBox="0 0 76 52" fill="none" role="img" aria-label="Logotipo Ruum Ruum">
      <text x="3" y="38" fill="var(--user-color-primary)" fontFamily="Inter, Arial, sans-serif" fontSize="39" fontWeight="800" letterSpacing="-6">RR</text>
      <path d="M5 44C16 24 26 45 37 26c5-8 11-8 18-4" stroke="var(--user-color-brand)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="5" cy="44" r="2.5" fill="var(--user-color-brand)" />
    </svg>
  );
}

function IconoLogoOscuro() {
  return (
    <span className="flex size-10 items-center justify-center rounded-full border-2 border-[#FFC400] bg-[#151515] shadow-sm" aria-hidden="true">
      <svg className="size-6 text-[#FFC400]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H8c-.7 0-1.3.3-1.8.7C5.3 8.6 4 10 4 10s-2.7.6-4.5 1.1C.7 11.3 0 12.1 0 13v3c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    </span>
  );
}

function IconoCampana({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconoHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21v-9h6v9" />
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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

export function NavegacionUsuario({ variante = "oscuro" }: { variante?: VarianteNavegacion }) {
  const pathname = usePathname();
  const esAcceso = pathname === "/login" || pathname === "/registro" || pathname === "/onboarding";
  const esClaro = variante === "claro";

  if (esAcceso) return null;

  return (
    <>
      <header
        id="homeHeader"
        role="banner"
        className={esClaro
          ? "user-v2-shell-header"
          : "sticky top-0 z-30 w-full border-b border-[#1C2A3E]/40 bg-[#070D18]/90 pt-[env(safe-area-inset-top)] backdrop-blur-md"}
      >
        <div className={esClaro ? "user-v2-shell-inner" : "mx-auto flex w-full max-w-[430px] items-center justify-between px-4 py-3"}>
          <Link href="/" className="group flex select-none items-center gap-2.5" aria-label="Ir al inicio de Ruum Ruum">
            {esClaro ? <IconoLogoUsuario /> : <IconoLogoOscuro />}
            <span className="flex flex-col leading-tight">
              <span className="flex items-baseline gap-1">
                <span className={esClaro ? "user-v2-logo-name user-v2-logo-name--primary" : "font-display text-[17px] font-extrabold tracking-tight text-white"}>Ruum</span>
                <span className={esClaro ? "user-v2-logo-name user-v2-logo-name--accent" : "font-display text-[17px] font-extrabold tracking-tight text-[#FFC400]"}>Ruum</span>
              </span>
              <span className={esClaro ? "user-v2-logo-tagline" : "font-body text-[10px] font-medium text-[#8E9CAE]"}>
                {esClaro ? "Tu camino, en orden." : "Usuario"}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/soporte"
              className={esClaro ? "user-v2-shell-icon-action relative" : "relative flex size-10 items-center justify-center rounded-full text-slate-200 hover:text-white"}
              aria-label="Notificaciones"
            >
              <IconoCampana />
              <span className={esClaro ? "user-v2-shell-notification-dot" : "absolute right-[7px] top-[6px] size-2 rounded-full border-2 border-white bg-[#FFC400]"} />
            </Link>
            {esClaro ? (
              <BotonCerrarSesion compact className="user-v2-shell-logout" />
            ) : (
              <Link href="/cuenta" className="flex size-9 items-center justify-center rounded-full border border-slate-600/80 text-slate-300 hover:border-[#FFC400] hover:text-white" aria-label="Mi cuenta">
                <IconoCuenta className="size-5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <nav
        id="bottomNavigation"
        aria-label="Navegación principal"
        className={esClaro
          ? "user-v2-shell-nav"
          : "fixed inset-x-0 bottom-0 z-40 border-t border-[#1C2A3E]/60 bg-[#070D18]/95 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md"}
      >
        <div className={esClaro ? "user-v2-shell-nav-inner" : "mx-auto w-full max-w-[430px] px-2"}>
          <div className="grid grid-cols-4 items-center">
            {DESTINOS.map((destino) => {
              const activo = estaActivo(pathname, destino.href);
              return (
                <Link
                  key={destino.href}
                  href={destino.href}
                  aria-current={activo ? "page" : undefined}
                  className={esClaro ? "user-v2-nav-link group select-none" : "group relative flex min-h-[53px] flex-col items-center justify-center gap-1 py-1.5 select-none"}
                >
                  {esClaro && <span className={`user-v2-nav-indicator ${activo ? "is-active" : ""}`} aria-hidden="true" />}
                  {!esClaro && activo && <span className="absolute bottom-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full bg-[#FFC400]" />}
                  <destino.Icono className={esClaro ? "size-[22px] transition-colors" : `size-[22px] transition-colors ${activo ? "text-[#FFC400]" : "text-[#8E9CAE]"}`} />
                  <span className={esClaro ? "transition-colors" : `font-body text-[10px] leading-none tracking-tight transition-colors ${activo ? "font-bold text-[#FFC400]" : "font-medium text-[#8E9CAE]"}`}>
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
