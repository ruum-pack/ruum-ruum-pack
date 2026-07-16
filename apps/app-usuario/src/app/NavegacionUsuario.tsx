"use client";

"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { crearClienteNavegador } from "../lib/supabase-browser";

/* Íconos SVG inline — reemplazan los caracteres Unicode ⌂ ▤ ? ◌ */
function IconoHome({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function IconoViajes({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8Z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function IconoAyuda({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const DESTINOS = [
  { href: "/", etiqueta: "Inicio", Icono: IconoHome },
  { href: "/mis-viajes", etiqueta: "Viajes", Icono: IconoViajes },
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

  return (
    <header className="mb-8 border-b border-ink/10 bg-mist/95 backdrop-blur supports-[backdrop-filter]:bg-mist/85">
      <div className="app-container flex min-h-16 items-center gap-4 py-3">
        <Link
          href="/"
          aria-label="Ir al inicio de Ruum Ruum"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-route-dark"
        >
          <LogoMarca tamano={30} color="signal" />
          <span className="font-display text-base font-extrabold tracking-tight text-ink">
            ruum<span className="text-signal">ruum</span>
          </span>
        </Link>

        {/* Nav escritorio */}
        <nav aria-label="Navegación principal" className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
          {DESTINOS.map(({ href, etiqueta, Icono }) => {
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
                      "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-medium",
                      activo || menuAbierto
                        ? "bg-signal text-ink shadow-sm"
                        : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink",
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
                      className="absolute right-0 top-full z-50 mt-1 w-44 rounded-[var(--ruum-radius-modal)] border border-ink/10 bg-mist py-1 shadow-3"
                    >
                      <Link
                        href="/cuenta"
                        role="menuitem"
                        onClick={() => setMenuAbierto(false)}
                        className="block px-4 py-2.5 font-body text-sm text-ink hover:bg-ink/[0.04]"
                      >
                        Mi cuenta
                      </Link>
                      <div className="my-1 h-px bg-ink/8" />
                      <button
                        role="menuitem"
                        onClick={cerrarSesion}
                        className="block w-full px-4 py-2.5 text-left font-body text-sm text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
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
                  "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 font-body text-sm font-medium",
                  activo
                    ? "bg-signal text-ink shadow-sm"
                    : "text-ink/65 hover:bg-ink/[0.05] hover:text-ink",
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
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-4 py-2.5 font-display text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-signal/90 hover:shadow-md focus-visible:outline-route-dark"
        >
          <span className="mr-2 text-lg leading-none" aria-hidden>+</span>
          <span className="hidden sm:inline">Solicitar traslado</span>
          <span className="sm:hidden">Traslado</span>
        </Link>
      </div>

      {/* Nav móvil — chips con ícono */}
      <nav aria-label="Navegación principal móvil" className="app-container flex gap-1 overflow-x-auto pb-3 md:hidden">
        {DESTINOS.map(({ href, etiqueta, Icono }) => {
          const activo = estaActivo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={activo ? "page" : undefined}
              className={[
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-2 font-body text-xs font-semibold",
                activo
                  ? "bg-signal text-ink"
                  : "border border-ink/10 bg-mist text-ink/65",
              ].join(" ")}
            >
              <Icono />
              {etiqueta}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
