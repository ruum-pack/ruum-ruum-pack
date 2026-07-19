"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import {
  BadgeContador,
  GRUPOS_NAVEGACION,
  Icono,
  rutaBase,
  useContadoresMenu
} from "./BarraLateral";

const PRIORITARIOS = ["/", "/viajes", "/conductores?filtro=en_revision", "/alertas-sla?filtro=vencidas"] as const;

function esActivo(pathname: string, href: string) {
  const base = rutaBase(href);
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

function buscarDestino(href: string) {
  const base = rutaBase(href);
  return GRUPOS_NAVEGACION.flatMap((grupo) => grupo.secciones).find((destino) => rutaBase(destino.href) === base);
}

export function NavegacionAdminMovil() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inicioToqueRef = useRef<number | null>(null);
  const contadores = useContadoresMenu(pathname);

  const destinosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return GRUPOS_NAVEGACION.map((grupo) => ({
      ...grupo,
      secciones: grupo.secciones.filter((seccion) => !termino || `${grupo.titulo} ${seccion.etiqueta}`.toLowerCase().includes(termino))
    })).filter((grupo) => grupo.secciones.length > 0);
  }, [busqueda]);

  useEffect(() => {
    if (!abierto) return;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("input, button, a")?.focus());
    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", cerrarConEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", cerrarConEscape);
      document.body.style.overflow = "";
      window.requestAnimationFrame(() => focoAnterior?.focus());
    };
  }, [abierto]);

  if (pathname === "/login") return null;

  const prioritarios = PRIORITARIOS.map(buscarDestino).filter(Boolean);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface-primary/95 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/85 lg:hidden">
      <div className="ruum-container flex min-h-16 items-center justify-between gap-3 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg" aria-label="Ir al centro de control">
          <LogoMarca tamano={28} color="signal" />
          <span className="font-display text-sm font-extrabold tracking-tight text-ink">
            ruum<span className="text-signal">ruum</span>
          </span>
          <span className="font-mono-ruum text-admin-secundario uppercase tracking-[0.12em] text-text-tertiary">Control</span>
        </Link>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex min-h-10 items-center rounded-lg border border-ink/15 bg-surface-primary px-3 py-2 font-body text-admin-boton font-bold text-ink shadow-sm"
          aria-haspopup="dialog"
          aria-expanded={abierto}
        >
          Más
        </button>
      </div>

      <nav aria-label="Accesos móviles prioritarios" className="ruum-container grid grid-cols-4 gap-1 pb-2.5">
        {prioritarios.map((destino) => {
          const activo = esActivo(pathname, destino.href);
          const contador = "contador" in destino ? contadores[destino.contador] : undefined;
          return (
            <Link
              key={destino.href}
              href={destino.href}
              aria-current={activo ? "page" : undefined}
              aria-label={destino.etiqueta}
              className={[
                "relative inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 font-body text-[11px] font-semibold",
                activo ? "bg-signal text-ink" : "border border-ink/10 bg-surface-primary text-text-secondary"
              ].join(" ")}
            >
              <Icono nombre={destino.icono} />
              <span className="w-full truncate text-center">{destino.etiqueta}</span>
              {contador && <BadgeContador contador={contador} colapsada />}
            </Link>
          );
        })}
      </nav>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-ink/45"
          role="presentation"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setAbierto(false);
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-movil-titulo"
            className="max-h-[88vh] w-full overflow-hidden rounded-t-2xl border border-border-default bg-surface-primary shadow-[var(--ruum-shadow-4)]"
            onTouchStart={(evento) => {
              inicioToqueRef.current = evento.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(evento) => {
              const inicio = inicioToqueRef.current;
              const fin = evento.changedTouches[0]?.clientY ?? null;
              if (inicio !== null && fin !== null && fin - inicio > 80) setAbierto(false);
              inicioToqueRef.current = null;
            }}
          >
            <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
              <div>
                <h2 id="menu-movil-titulo" className="font-display text-lg font-semibold text-ink">Secciones</h2>
                <p className="font-body text-admin-secundario text-text-tertiary">Todos los módulos del panel</p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-ink/15 text-ink"
                aria-label="Cerrar menú de secciones"
              >
                ×
              </button>
            </div>
            <div className="border-b border-border-default px-4 py-3">
              <label className="sr-only" htmlFor="buscar-secciones-admin">Buscar secciones</label>
              <input
                id="buscar-secciones-admin"
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar sección..."
                className="w-full rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary"
              />
            </div>
            <nav className="max-h-[62vh] overflow-y-auto px-4 py-4" aria-label="Todas las secciones del panel">
              <div className="grid gap-5">
                {destinosFiltrados.map((grupo) => (
                  <section key={grupo.titulo} aria-label={grupo.titulo}>
                    <p className="mb-2 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary">{grupo.titulo}</p>
                    <div className="grid gap-2">
                      {grupo.secciones.map((seccion) => {
                        const activo = esActivo(pathname, seccion.href);
                        const contador = "contador" in seccion ? contadores[seccion.contador] : undefined;
                        return (
                          <Link
                            key={seccion.href}
                            href={seccion.href}
                            onClick={() => setAbierto(false)}
                            aria-current={activo ? "page" : undefined}
                            className={[
                              "relative flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 font-body text-sm font-semibold",
                              activo ? "border-signal bg-signal-soft text-ink" : "border-ink/10 text-text-secondary"
                            ].join(" ")}
                          >
                            <span className="flex size-8 items-center justify-center rounded-md bg-ink/[0.04]"><Icono nombre={seccion.icono} /></span>
                            <span className="min-w-0 flex-1">{seccion.etiqueta}</span>
                            {contador && <BadgeContador contador={contador} colapsada={false} />}
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
