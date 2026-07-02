"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";

const GRUPOS_NAVEGACION = [
  {
    titulo: "Operación",
    secciones: [
      { href: "/", etiqueta: "Dashboard", icono: "D" },
      { href: "/viajes", etiqueta: "Viajes", icono: "V" },
      { href: "/mapa", etiqueta: "Mapa operativo", icono: "M" },
      { href: "/alertas-sla", etiqueta: "Alertas SLA", icono: "S" }
    ]
  },
  {
    titulo: "Personas",
    secciones: [
      { href: "/conductores", etiqueta: "Conductores", icono: "C" },
      { href: "/usuarios", etiqueta: "Usuarios", icono: "U" },
      { href: "/empresas", etiqueta: "Empresas", icono: "E" }
    ]
  },
  {
    titulo: "Incidentes",
    secciones: [
      { href: "/incidencias", etiqueta: "Incidencias", icono: "I" },
      { href: "/disputas", etiqueta: "Disputas", icono: "D" },
      { href: "/reclamos-seguro", etiqueta: "Reclamos seguro", icono: "R" }
    ]
  },
  {
    titulo: "Finanzas y config",
    secciones: [
      { href: "/pagos", etiqueta: "Pagos", icono: "P" },
      { href: "/tarifas", etiqueta: "Tarifas", icono: "T" },
      { href: "/documentos", etiqueta: "Documentos", icono: "O" },
      { href: "/reportes", etiqueta: "Reportes", icono: "R" },
      { href: "/configuracion", etiqueta: "Configuración", icono: "A" }
    ]
  }
] as const;

const SECCIONES_PENDIENTES = [
  { etiqueta: "Evidencia", icono: "E" },
  { etiqueta: "Auditoría", icono: "A" }
] as const;

export function BarraLateral() {
  const pathname = usePathname();
  const router = useRouter();
  const [sesionReal, setSesionReal] = useState(false);
  const [colapsada, setColapsada] = useState(false);

  useEffect(() => {
    setColapsada(window.localStorage.getItem("ruum-admin-sidebar") === "colapsada");
  }, []);

  function alternarColapso() {
    setColapsada((actual) => {
      const siguiente = !actual;
      window.localStorage.setItem("ruum-admin-sidebar", siguiente ? "colapsada" : "expandida");
      return siguiente;
    });
  }

  useEffect(() => {
    async function revisar() {
      if (!tieneSupabaseConfigurado()) return;
      try {
        const cliente = crearClienteNavegador();
        const { data } = await cliente.auth.getUser();
        setSesionReal(Boolean(data.user));
      } catch {
        // Sin sesión real disponible — se queda en false.
      }
    }
    revisar();
  }, [pathname]);

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={`flex h-screen shrink-0 flex-col bg-ink transition-[width] ${colapsada ? "w-16" : "w-16 lg:w-60"}`}>
      {/* Logo + marca */}
      <div className={colapsada ? "px-3 py-5" : "px-3 py-5 lg:px-5"}>
        <span className="flex items-center gap-2.5">
          <LogoMarca tamano={28} color="signal" />
          <span className={`font-display text-base font-bold tracking-tight text-mist ${colapsada ? "hidden" : "hidden lg:inline"}`}>
            <span className="text-signal">ruum</span>ruum
          </span>
        </span>
        <p className={`mt-0.5 font-mono-ruum text-[10px] uppercase tracking-widest text-mist/35 ${colapsada ? "hidden" : "hidden lg:block"}`}>
          Torre de Control
        </p>
        <button
          type="button"
          onClick={alternarColapso}
          className="mt-4 hidden rounded-md border border-mist/15 px-2.5 py-1.5 font-mono-ruum text-[10px] uppercase tracking-wide text-mist/45 transition-colors hover:bg-mist/5 hover:text-mist/70 lg:block"
          aria-label={colapsada ? "Expandir navegación" : "Colapsar navegación"}
        >
          {colapsada ? ">>" : "<<"}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-3 lg:px-3">
        {GRUPOS_NAVEGACION.map((grupo) => (
          <div key={grupo.titulo}>
            <p className={`mb-1.5 px-2 font-mono-ruum text-[10px] uppercase tracking-widest text-mist/30 ${colapsada ? "hidden" : "hidden lg:block"}`}>
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.secciones.map((s) => {
                const activo = pathname === s.href || (s.href !== "/" && pathname.startsWith(s.href));
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    title={s.etiqueta}
                    aria-current={activo ? "page" : undefined}
                    className={[
                      "flex items-center gap-2.5 rounded-lg px-2 py-2 font-body text-sm font-medium transition-colors",
                      activo
                        ? "bg-signal text-ink"
                        : "text-mist/60 hover:bg-white/8 hover:text-mist"
                    ].join(" ")}
                  >
                    <span className={[
                      "flex size-7 shrink-0 items-center justify-center rounded-md font-mono-ruum text-[11px] font-medium",
                      activo ? "bg-black/15 text-ink" : "bg-white/8 text-current"
                    ].join(" ")}>
                      {s.icono}
                    </span>
                    <span className={colapsada ? "hidden" : "hidden lg:inline"}>{s.etiqueta}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="border-t border-mist/10 pt-4">
          {SECCIONES_PENDIENTES.map((s) => (
            <div key={s.etiqueta} title={s.etiqueta} className="flex items-center gap-2.5 rounded-lg px-2 py-2 font-body text-sm text-mist/25">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 font-mono-ruum text-[11px]">
                {s.icono}
              </span>
              <span className={colapsada ? "hidden" : "hidden lg:inline"}>{s.etiqueta}</span>
              <span className={`ml-auto font-mono-ruum text-[9px] uppercase tracking-wide ${colapsada ? "hidden" : "hidden lg:inline"}`}>
                Próximamente
              </span>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer sesión */}
      <div className={`border-t border-mist/10 ${colapsada ? "px-3 py-4" : "px-3 py-4 lg:px-5"}`}>
        {sesionReal ? (
          <button
            onClick={cerrarSesion}
            className="w-full rounded-lg border border-mist/15 px-3 py-2 font-body text-sm font-medium text-mist/60 transition-colors hover:bg-white/5 hover:text-mist"
            title="Cerrar sesión"
          >
            <span className={colapsada ? "hidden" : "hidden lg:inline"}>Cerrar sesión</span>
            <span className={`font-mono-ruum text-xs ${colapsada ? "inline" : "lg:hidden"}`}>CS</span>
          </button>
        ) : (
          tieneSupabaseConfigurado() && (
            <Link
              href="/login"
              className="block rounded-lg border border-mist/15 px-3 py-2 text-center font-body text-sm font-medium text-mist/60 transition-colors hover:bg-white/5 hover:text-mist"
              title="Iniciar sesión"
            >
              <span className={colapsada ? "hidden" : "hidden lg:inline"}>Iniciar sesión</span>
              <span className={`font-mono-ruum text-xs ${colapsada ? "inline" : "lg:hidden"}`}>IS</span>
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
