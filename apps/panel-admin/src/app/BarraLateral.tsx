"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";

const SECCIONES_CONSTRUIDAS = [
  { href: "/", etiqueta: "Dashboard" },
  { href: "/viajes", etiqueta: "Viajes" },
  { href: "/conductores", etiqueta: "Conductores" },
  { href: "/usuarios", etiqueta: "Usuarios" },
  { href: "/incidencias", etiqueta: "Incidencias" },
  { href: "/disputas", etiqueta: "Disputas" },
  { href: "/reclamos-seguro", etiqueta: "Reclamos seguro" },
  { href: "/pagos", etiqueta: "Pagos" },
  { href: "/documentos", etiqueta: "Documentos" },
  { href: "/tarifas", etiqueta: "Tarifas" },
  { href: "/empresas", etiqueta: "Empresas" },
  { href: "/reportes", etiqueta: "Reportes" },
  { href: "/configuracion", etiqueta: "Configuración" }
] as const;

const SECCIONES_PENDIENTES = [
  "Mapa operativo",
  "Alertas SLA verificación",
  "Evidencia",
  "Auditoría"
] as const;

export function BarraLateral() {
  const pathname = usePathname();
  const router = useRouter();
  const [sesionReal, setSesionReal] = useState(false);

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
    <aside className="flex h-screen w-60 flex-col border-r border-ink/10 bg-mist">
      <div className="px-5 py-6">
        <span className="flex items-center gap-2">
          <LogoMarca tamano={26} color="control" />
          <span className="font-display text-base font-semibold tracking-tight">Ruum Ruum</span>
        </span>
        <p className="font-mono-ruum text-[10px] uppercase tracking-wide text-ink/45">Torre de Control</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {SECCIONES_CONSTRUIDAS.map((s) => {
          const activo = pathname === s.href || (s.href !== "/" && pathname.startsWith(s.href));
          return (
            <Link
              key={s.href}
              href={s.href}
              className={[
                "block rounded-lg px-3 py-2 font-body text-sm font-medium transition-colors",
                activo ? "bg-signal-soft text-signal" : "text-ink/65 hover:bg-ink/5 hover:text-ink"
              ].join(" ")}
            >
              {s.etiqueta}
            </Link>
          );
        })}

        <div className="mt-4 border-t border-ink/10 pt-4">
          {SECCIONES_PENDIENTES.map((s) => (
            <div key={s} className="flex items-center justify-between rounded-lg px-3 py-2 font-body text-sm text-ink/35">
              <span>{s}</span>
              <span className="font-mono-ruum text-[9px] uppercase tracking-wide">Próximamente</span>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-ink/10 px-5 py-4">
        {sesionReal ? (
          <button onClick={cerrarSesion} className="font-body text-sm text-ink/55 hover:text-ink">
            Cerrar sesión
          </button>
        ) : (
          tieneSupabaseConfigurado() && (
            <Link href="/login" className="font-body text-sm text-ink/55 hover:text-ink">
              Iniciar sesión
            </Link>
          )
        )}
      </div>
    </aside>
  );
}
