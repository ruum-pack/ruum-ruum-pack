"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { crearClienteNavegador } from "../lib/supabase-browser";

/* Íconos SVG inline optimizados */
function IconoHome({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconoViajes({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconoPlus({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconoAyuda({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function IconoCuenta({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const DESTINOS_ESCRITORIO = [
  { href: "/", etiqueta: "Inicio", Icono: IconoHome },
  { href: "/mis-viajes", etiqueta: "Viajes", Icono: IconoViajes },
  { href: "/soporte", etiqueta: "Ayuda", Icono: IconoAyuda },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: IconoCuenta },
] as const;

const DESTINOS_MOVIL = [
  { href: "/", etiqueta: "Inicio", Icono: IconoHome },
  { href: "/mis-viajes", etiqueta: "Viajes", Icono: IconoViajes },
  { href: "/traslados/nuevo", etiqueta: "Solicitar", Icono: IconoPlus, esDestacado: true },
  { href: "/soporte", etiqueta: "Ayuda", Icono: IconoAyuda },
  { href: "/cuenta", etiqueta: "Cuenta", Icono: IconoCuenta },
] as const;

function estaActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavegacionUsuario() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuCuentaRef = useRef<HTMLDivElement>(null);
  const botonCuentaRef = useRef<HTMLButtonElement>(null);
  const menuCuentaPanelRef = useRef<HTMLDivElement>(null);

  const esAcceso = pathname === "/login" || pathname === "/registro" || pathname === "/onboarding";

  useEffect(() => {
    if (!menuAbierto) return;

    function cerrarSiClickFuera(evento: MouseEvent) {
      if (menuCuentaRef.current?.contains(evento.target as Node)) return;
      window.setTimeout(() => setMenuAbierto(false), 150);
    }

    document.addEventListener("click", cerrarSiClickFuera);
    return () => document.removeEventListener("click", cerrarSiClickFuera);
  }, [menuAbierto]);

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function cerrarMenuCuentaConFoco() {
    setMenuAbierto(false);
    window.requestAnimationFrame(() => botonCuentaRef.current?.focus());
  }

  function enfocarItemMenuCuenta(direccion: 1 | -1) {
    const items = Array.from(menuCuentaPanelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;

    const indiceActual = items.indexOf(document.activeElement as HTMLElement);
    const siguienteIndice = indiceActual === -1 ? (direccion === 1 ? 0 : items.length - 1) : (indiceActual + direccion + items.length) % items.length;
    items[siguienteIndice]?.focus();
  }

  function manejarTeclasMenuCuenta(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrarMenuCuentaConFoco();
      return;
    }

    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      enfocarItemMenuCuenta(evento.key === "ArrowDown" ? 1 : -1);
    }
  }

  function manejarTeclasBotonCuenta(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.key === "Escape" && menuAbierto) {
      evento.preventDefault();
      cerrarMenuCuentaConFoco();
      return;
    }

    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setMenuAbierto(true);
      window.requestAnimationFrame(() => enfocarItemMenuCuenta(evento.key === "ArrowDown" ? 1 : -1));
    }
  }

  if (esAcceso) return null;

  return (
    <>
      {/* Encabezado para escritorio (oculto en móvil para diseño nativo) */}
      <header role="banner" className="hidden md:block sticky top-0 z-30 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="ruum-container flex min-h-16 items-center gap-4 py-3">
          <Link
            href="/"
            aria-label="Ir al inicio de Ruum Ruum"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-route-dark"
          >
            <LogoMarca variante="horizontal" tema="oscuro" tamano={30} mostrarDescriptor={false} mostrarRespaldo={false} />
            <span className="hidden font-body text-xs font-semibold text-text-tertiary lg:inline">Usuario</span>
          </Link>

          {/* Navegación escritorio */}
          <nav aria-label="Navegación principal" className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {DESTINOS_ESCRITORIO.map(({ href, etiqueta, Icono }) => {
              const activo = estaActivo(pathname, href);
              if (href === "/cuenta") {
                return (
                  <div key={href} ref={menuCuentaRef} className="relative">
                    <button
                      ref={botonCuentaRef}
                      onClick={() => setMenuAbierto(v => !v)}
                      onKeyDown={manejarTeclasBotonCuenta}
                      aria-expanded={menuAbierto}
                      aria-haspopup="menu"
                      aria-controls={menuAbierto ? "menu-cuenta-usuario" : undefined}
                      aria-label="Menú de cuenta"
                      className={[
                        "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold",
                        activo || menuAbierto
                          ? "bg-action-primary text-on-primary shadow-sm"
                          : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
                      ].join(" ")}
                    >
                      <Icono />
                      {etiqueta}
                    </button>
                    {menuAbierto && (
                      <div
                        ref={menuCuentaPanelRef}
                        id="menu-cuenta-usuario"
                        role="menu"
                        onKeyDown={manejarTeclasMenuCuenta}
                        className="absolute right-0 top-full z-50 mt-1 w-44 rounded-[var(--ruum-radius-modal)] border border-border bg-surface py-1 shadow-3"
                      >
                        <Link
                          href="/cuenta"
                          role="menuitem"
                          onClick={() => setMenuAbierto(false)}
                          className="block px-4 py-2.5 font-body text-sm text-text-primary hover:bg-surface-elevated"
                        >
                          Mi cuenta
                        </Link>
                        <div className="my-1 h-px bg-border" />
                        <button
                          role="menuitem"
                          onClick={cerrarSesion}
                          className="block w-full px-4 py-2.5 text-left font-body text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
                        >
                          Cerrar sesión
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={[
                    "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-semibold",
                    activo
                      ? "bg-action-primary text-on-primary shadow-sm"
                      : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
                  ].join(" ")}
                >
                  <Icono />
                  {etiqueta}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/traslados/nuevo"
            className="ml-auto inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 font-display text-sm font-semibold text-text-primary shadow-xs transition hover:border-route-action/60 hover:bg-surface-elevated hover:text-text-primary focus-visible:outline-route-dark"
          >
            <span className="mr-1.5 text-base font-bold text-route-action" aria-hidden>+</span>
            <span>Solicitar traslado</span>
          </Link>
        </div>
      </header>

      {/* Navegación móvil fija al fondo adaptada al Brand Book */}
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-surface/95 border-t border-border/20 backdrop-blur-md pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] supports-[backdrop-filter]:bg-surface/80">
        <nav aria-label="Navegación principal móvil" className="w-full px-1 max-w-md mx-auto">
          <div className="grid grid-cols-5 gap-0.5 items-end">
            {DESTINOS_MOVIL.map((destino) => {
              const activo = estaActivo(pathname, destino.href);

              if ("esDestacado" in destino && destino.esDestacado) {
                return (
                  <Link
                    key={destino.href}
                    href={destino.href}
                    aria-current={activo ? "page" : undefined}
                    aria-label="Solicitar nuevo traslado"
                    className="relative flex flex-col items-center justify-center gap-1 py-1 text-center select-none"
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-signal text-slate-950 shadow-md shadow-signal/30 transition-transform active:scale-95">
                      <destino.Icono />
                    </span>
                    <span className="max-w-full truncate font-display text-[10px] font-bold leading-none text-signal">
                      {destino.etiqueta}
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={destino.href}
                  href={destino.href}
                  aria-current={activo ? "page" : undefined}
                  className={[
                    "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 min-h-[52px] font-body text-[10px] leading-none transition-colors duration-200 select-none",
                    activo
                      ? "text-text-primary dark:text-signal font-black bg-signal/20 dark:bg-signal/15 shadow-2xs"
                      : "text-text-secondary hover:text-text-primary"
                  ].join(" ")}
                >
                  <div className="relative flex items-center justify-center p-0.5">
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

