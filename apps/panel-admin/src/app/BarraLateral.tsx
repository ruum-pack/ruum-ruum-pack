"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMarca } from "@ruum/ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  listarAlertasSLA,
  listarConductoresAdmin,
  listarDisputasAdmin,
  listarIncidenciasAdmin,
  obtenerAdminActual,
  listarPagosAdmin,
  listarSolicitudesConductorAdmin,
  listarUsuariosAdmin
} from "@ruum/api/services";
import { normalizarRolAdmin, puedeVerRuta, type RolAdminOperativo } from "../lib/roles-admin";

/* ── Íconos SVG inline — reemplazan las letras sueltas D/V/I/R ── */
function IcDashboard() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}
function IcViajes() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8Z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
}
function IcMasivos() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v5H4z"/><path d="M4 15h16v5H4z"/><path d="M8 9v6M16 9v6"/><path d="M8 6h.01M8 17h.01"/></svg>;
}
function IcMapa() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s6-5.1 6-10a6 6 0 0 0-12 0c0 4.9 6 10 6 10Z"/><circle cx="12" cy="11" r="2.4"/></svg>;
}
function IcSLA() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
}
function IcConductor() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M16 11l2 2 4-4" strokeWidth="2"/></svg>;
}
function IcUsuario() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
}
function IcVehiculo() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5"/><path d="M5 13h14a2 2 0 0 1 2 2v3h-3"/><path d="M6 18H3v-3a2 2 0 0 1 2-2"/><circle cx="7.5" cy="18" r="2"/><circle cx="16.5" cy="18" r="2"/><path d="M8 10h8"/></svg>;
}
function IcEmpresa() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-6h6v6"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>;
}
function IcIncidencia() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4m0 4h.01"/></svg>;
}
function IcDisputa() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>;
}
function IcReclamo() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 18 6v5c0 4-2.5 6.8-6 8-3.5-1.2-6-4-6-8V6l6-2Z"/><path d="M9 12l2 2 4-4"/></svg>;
}
function IcPagos() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>;
}
function IcTarifas() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></svg>;
}
function IcDocumentos() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5m-5 4h5"/></svg>;
}
function IcReportes() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 20V10m-6 10V4M6 20v-6"/></svg>;
}
function IcConfiguracion() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>;
}
function IcEvidencia() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>;
}
function IcAuditoria() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
}

export type IconoNombre = "dashboard"|"viajes"|"masivos"|"mapa"|"sla"|"conductor"|"usuario"|"vehiculo"|"empresa"|"incidencia"|"disputa"|"reclamo"|"pagos"|"tarifas"|"documentos"|"reportes"|"configuracion"|"evidencia"|"auditoria";
export type ClaveContadorMenu = "alertasCriticas" | "conductoresRevision" | "incidenciasAbiertas" | "disputasPendientes" | "pagosPendientes" | "documentosPorVencer";
export type ContadorMenu = { valor: number; critico?: boolean; etiqueta: string };
export type ContadoresMenu = Partial<Record<ClaveContadorMenu, ContadorMenu>>;
export type SeccionNavegacionAdmin = { href: string; etiqueta: string; icono: IconoNombre; contador?: ClaveContadorMenu };
export type GrupoNavegacionAdmin = { titulo: string; secciones: SeccionNavegacionAdmin[] };

export function Icono({ nombre }: { nombre: IconoNombre }) {
  const map: Record<IconoNombre, React.ReactNode> = {
    dashboard: <IcDashboard />, viajes: <IcViajes />, masivos: <IcMasivos />, mapa: <IcMapa />, sla: <IcSLA />,
    conductor: <IcConductor />, usuario: <IcUsuario />, vehiculo: <IcVehiculo />, empresa: <IcEmpresa />,
    incidencia: <IcIncidencia />, disputa: <IcDisputa />, reclamo: <IcReclamo />,
    pagos: <IcPagos />, tarifas: <IcTarifas />, documentos: <IcDocumentos />,
    reportes: <IcReportes />, configuracion: <IcConfiguracion />,
    evidencia: <IcEvidencia />, auditoria: <IcAuditoria />,
  };
  return <>{map[nombre]}</>;
}

export const GRUPOS_NAVEGACION: GrupoNavegacionAdmin[] = [
  {
    titulo: "OPERACIÓN",
    secciones: [
      { href: "/", etiqueta: "Centro de control", icono: "dashboard" },
      { href: "/viajes", etiqueta: "Traslados", icono: "viajes" },
      { href: "/masivos", etiqueta: "Cargas masivas", icono: "masivos" },
      { href: "/mapa", etiqueta: "Mapa", icono: "mapa" },
      { href: "/alertas-sla?filtro=vencidas", etiqueta: "Alertas y SLA", icono: "sla", contador: "alertasCriticas" },
    ],
  },
  {
    titulo: "GESTIÓN",
    secciones: [
      { href: "/conductores?filtro=en_revision", etiqueta: "Conductores", icono: "conductor", contador: "conductoresRevision" },
      { href: "/metricas-registro", etiqueta: "Métricas de conductores", icono: "reportes" },
      { href: "/usuarios", etiqueta: "Usuarios", icono: "usuario" },
      { href: "/vehiculos", etiqueta: "Vehículos", icono: "vehiculo" },
      { href: "/empresas", etiqueta: "Empresas", icono: "empresa" },
    ],
  },
  {
    titulo: "CASOS Y RIESGOS",
    secciones: [
      { href: "/incidencias?filtro=abiertas", etiqueta: "Incidencias", icono: "incidencia", contador: "incidenciasAbiertas" },
      { href: "/disputas?filtro=pendientes", etiqueta: "Disputas", icono: "disputa", contador: "disputasPendientes" },
      { href: "/reclamos-seguro", etiqueta: "Seguros", icono: "reclamo" },
      { href: "/documentos?filtro=por_vencer", etiqueta: "Validación documental", icono: "documentos", contador: "documentosPorVencer" },
    ],
  },
  {
    titulo: "ADMINISTRACIÓN",
    secciones: [
      { href: "/pagos?filtro=pendientes", etiqueta: "Pagos", icono: "pagos", contador: "pagosPendientes" },
      { href: "/tarifas", etiqueta: "Tarifas", icono: "tarifas" },
      { href: "/reportes", etiqueta: "Reportes operativos", icono: "reportes" },
      { href: "/aprobaciones", etiqueta: "Aprobaciones duales", icono: "auditoria" },
      { href: "/auditoria", etiqueta: "Auditoría", icono: "auditoria" },
      { href: "/configuracion", etiqueta: "Configuración", icono: "configuracion" },
    ],
  },
];

export function rutaBase(href: string) {
  return href.split("?")[0] ?? href;
}

export function BadgeContador({ contador, colapsada }: { contador: ContadorMenu; colapsada: boolean }) {
  if (contador.valor <= 0) return null;
  const texto = contador.critico ? `Crítico: ${contador.valor}` : String(contador.valor);
  return (
    <span
      className={[
        "ml-auto inline-flex min-w-7 items-center justify-center rounded-full border px-2 py-0.5 font-mono-ruum text-admin-secundario font-semibold",
        contador.critico ? "border-status-error/45 bg-status-error-soft text-status-error" : "border-status-info/35 bg-status-info-soft text-status-info",
        colapsada ? "absolute right-0 top-0 translate-x-1 -translate-y-1" : ""
      ].join(" ")}
      aria-label={`${contador.etiqueta}: ${texto}`}
      title={`${contador.etiqueta}: ${texto}`}
    >
      {contador.critico && <span className="mr-1" aria-hidden="true">!</span>}
      {contador.valor}
    </span>
  );
}

export function useContadoresMenu(pathname: string) {
  const [contadores, setContadores] = useState<ContadoresMenu>({});

  useEffect(() => {
    async function cargarContadores() {
      if (!tieneSupabaseConfigurado()) {
        setContadores({});
        return;
      }
      try {
        const cliente = crearClienteNavegador();
        const [alertas, solicitudes, incidencias, disputas, pagos, conductores, usuarios] = await Promise.all([
          listarAlertasSLA(cliente),
          listarSolicitudesConductorAdmin(cliente),
          listarIncidenciasAdmin(cliente),
          listarDisputasAdmin(cliente),
          listarPagosAdmin(cliente),
          listarConductoresAdmin(cliente),
          listarUsuariosAdmin(cliente)
        ]);
        const documentosPendientes = conductores.filter((conductor) => !conductor.documentos_vigentes).length
          + usuarios.filter((usuario) => usuario.estado_verificacion === "pendiente" || usuario.estado_verificacion === "en_revision").length;

        setContadores({
          alertasCriticas: {
            valor: alertas.filter((alerta) => alerta.vencido).length,
            critico: true,
            etiqueta: "Alertas críticas vencidas"
          },
          conductoresRevision: {
            valor: solicitudes.filter((fila) => fila.solicitud.estado === "en_revision").length,
            etiqueta: "Conductores por revisar"
          },
          incidenciasAbiertas: {
            valor: incidencias.filter((incidencia) => !incidencia.resuelta).length,
            critico: incidencias.some((incidencia) => !incidencia.resuelta),
            etiqueta: "Incidencias abiertas"
          },
          disputasPendientes: {
            valor: disputas.filter((disputa) => disputa.estado !== "resuelta" && disputa.estado !== "resuelta_senior").length,
            etiqueta: "Disputas pendientes"
          },
          pagosPendientes: {
            valor: pagos.pagosUsuarios.filter((pago) => pago.estado === "pendiente").length
              + pagos.payoutsConductores.filter((payout) => payout.estado === "pendiente").length,
            etiqueta: "Pagos pendientes"
          },
          documentosPorVencer: {
            valor: documentosPendientes,
            etiqueta: "Documentos por vencer o actualizar"
          }
        });
      } catch {
        setContadores({});
      }
    }
    void cargarContadores();
  }, [pathname]);

  return contadores;
}

export function BarraLateral() {
  const pathname = usePathname();
  const router = useRouter();
  const [sesionReal, setSesionReal] = useState(false);
  const [rolAdmin, setRolAdmin] = useState<RolAdminOperativo>("operador");
  const [colapsada, setColapsada] = useState(false);
  const contadores = useContadoresMenu(pathname);

  useEffect(() => {
  const isColapsada = window.localStorage.getItem("ruum-admin-sidebar") === "colapsada";
  const timer = setTimeout(() => {
    setColapsada(isColapsada);
  }, 0);
  return () => clearTimeout(timer);
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
        const [usuario, admin] = await Promise.all([
          cliente.auth.getUser(),
          obtenerAdminActual(cliente)
        ]);
        const { data } = usuario;
        setSesionReal(Boolean(data.user));
        setRolAdmin(normalizarRolAdmin(admin?.rol_operativo));
      } catch { /* Sin sesión real */ }
    }
    revisar();
  }, [pathname]);

  async function cerrarSesion() {
    const cliente = crearClienteNavegador();
    await cliente.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (pathname === "/login") return null;

  const gruposVisibles = GRUPOS_NAVEGACION
    .map((grupo) => ({
      ...grupo,
      secciones: grupo.secciones.filter((seccion) => puedeVerRuta(rolAdmin, seccion.href))
    }))
    .filter((grupo) => grupo.secciones.length > 0);

  return (
    <aside
      className={`hidden h-screen shrink-0 flex-col bg-ink shadow-[var(--ruum-shadow-2)] lg:flex transition-[width] ${colapsada ? "w-16" : "w-60"}`}
      aria-label="Navegación principal"
    >
      {/* Logo */}
      <div className={colapsada ? "px-3 py-5" : "px-3 py-5 lg:px-5"}>
        <span className="flex items-center gap-2.5">
          <LogoMarca tamano={28} color="signal" />
          <span className={`font-display text-base font-bold tracking-tight text-mist ${colapsada ? "hidden" : "hidden lg:inline"}`}>
            <span className="text-signal">ruum</span>ruum
          </span>
        </span>
        <p className={`mt-0.5 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary ${colapsada ? "hidden" : "hidden lg:block"}`}>
          Torre de Control
        </p>
        <button
          type="button"
          onClick={alternarColapso}
          className="mt-4 hidden rounded-md border border-mist/15 px-2.5 py-1.5 font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary transition-colors hover:bg-surface-primary/5 hover:text-text-secondary lg:block"
          aria-label={colapsada ? "Expandir navegación" : "Colapsar navegación"}
        >
          {colapsada ? ">>" : "<<"}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-3 lg:px-3" aria-label="Secciones del panel">
        {gruposVisibles.map((grupo) => (
          <section key={grupo.titulo} aria-label={grupo.titulo}>
            <p className={`mb-1.5 px-2 font-mono-ruum text-admin-secundario uppercase tracking-widest text-text-tertiary ${colapsada ? "sr-only" : "hidden lg:block"}`}>
              {grupo.titulo}
            </p>
            <div className="space-y-0.5">
              {grupo.secciones.map((s) => {
                const base = rutaBase(s.href);
                const contador = s.contador ? contadores[s.contador] : undefined;
                const activo = pathname === base || (base !== "/" && pathname.startsWith(base));
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    title={s.etiqueta}
                    aria-label={s.etiqueta}
                    aria-current={activo ? "page" : undefined}
                    className={[
                      "relative flex items-center gap-2.5 rounded-lg px-2 py-2 font-body text-sm font-medium transition-colors",
                      activo ? "bg-signal text-ink" : "text-text-secondary hover:bg-white/8 hover:text-mist",
                    ].join(" ")}
                  >
                    <span className={[
                      "flex size-7 shrink-0 items-center justify-center rounded-md",
                      activo ? "bg-black/15 text-ink" : "bg-white/8 text-current",
                    ].join(" ")}>
                      <Icono nombre={s.icono} />
                    </span>
                    <span className={colapsada ? "hidden" : "hidden lg:inline"}>{s.etiqueta}</span>
                    {contador && <BadgeContador contador={contador} colapsada={colapsada} />}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {/* Footer sesión */}
      <div className={`border-t border-mist/10 ${colapsada ? "px-3 py-4" : "px-3 py-4 lg:px-5"}`}>
        {sesionReal ? (
          <button
            onClick={cerrarSesion}
            className="w-full rounded-lg border border-mist/15 px-3 py-2 font-body text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-mist"
            title="Cerrar sesión"
          >
            <span className={colapsada ? "hidden" : "hidden lg:inline"}>Cerrar sesión</span>
            <span className={`font-mono-ruum text-xs ${colapsada ? "inline" : "lg:hidden"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
          </button>
        ) : (
          tieneSupabaseConfigurado() && (
            <Link
              href="/login"
              className="block rounded-lg border border-mist/15 px-3 py-2 text-center font-body text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-mist"
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
