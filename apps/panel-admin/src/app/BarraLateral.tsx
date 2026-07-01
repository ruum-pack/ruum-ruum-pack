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
    <aside className={`flex h-screen shrink-0 flex-col border-r border-ink/10 bg-mist transition-[width] ${colapsada ? "w-16" : "w-16 lg:w-60"}`}>
      <div className={colapsada ? "px-3 py-6" : "px-3 py-6 lg:px-5"}>
        <span className="flex items-center gap-2">
          <LogoMarca tamano={26} color="control" />
          <span className={`font-display text-base font-semibold tracking-tight ${colapsada ? "hidden" : "hidden lg:inline"}`}>Ruum Ruum</span>
        </span>
        <p className={`font-mono-ruum text-[10px] uppercase tracking-wide text-ink/45 ${colapsada ? "hidden" : "hidden lg:block"}`}>
          Torre de Control
        </p>
        <button
          type="button"
          onClick={alternarColapso}
          className="mt-4 hidden rounded-lg border border-ink/50 px-2.5 py-1.5 font-mono-ruum text-[10px] uppercase tracking-wide text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink lg:block"
          aria-label={colapsada ? "Expandir navegación" : "Colapsar navegación"}
        >
          {colapsada ? ">>" : "<<"}
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {GRUPOS_NAVEGACION.map((grupo) => (
          <div key={grupo.titulo}>
            <p className={`mb-1 px-2 font-mono-ruum text-[10px] uppercase tracking-wide text-ink/45 ${colapsada ? "hidden" : "hidden lg:block"}`}>
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
                      "flex items-center gap-2 rounded-lg px-2 py-2 font-body text-sm font-medium transition-colors",
                      activo ? "bg-signal-soft text-ink" : "text-ink/65 hover:bg-ink/5 hover:text-ink"
                    ].join(" ")}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-current/20 font-mono-ruum text-[10px]">
                      {s.icono}
                    </span>
                    <span className={colapsada ? "hidden" : "hidden lg:inline"}>{s.etiqueta}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-4 border-t border-ink/10 pt-4">
          {SECCIONES_PENDIENTES.map((s) => (
            <div key={s.etiqueta} title={s.etiqueta} className="flex items-center gap-2 rounded-lg px-2 py-2 font-body text-sm text-ink/35">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-current/20 font-mono-ruum text-[10px]">
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

      <div className={colapsada ? "border-t border-ink/10 px-3 py-4" : "border-t border-ink/10 px-3 py-4 lg:px-5"}>
        {sesionReal ? (
          <button onClick={cerrarSesion} className="font-body text-sm text-ink/55 hover:text-ink" title="Cerrar sesión">
            <span className={colapsada ? "hidden" : "hidden lg:inline"}>Cerrar sesión</span>
            <span className={`font-mono-ruum text-xs ${colapsada ? "inline" : "lg:hidden"}`}>CS</span>
          </button>
        ) : (
          tieneSupabaseConfigurado() && (
            <Link href="/login" className="font-body text-sm text-ink/55 hover:text-ink" title="Iniciar sesión">
              <span className={colapsada ? "hidden" : "hidden lg:inline"}>Iniciar sesión</span>
              <span className={`font-mono-ruum text-xs ${colapsada ? "inline" : "lg:hidden"}`}>IS</span>
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
