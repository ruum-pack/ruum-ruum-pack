"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { AdminPanel } from "./admin-ui";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  obtenerIndicadoresAccionablesDashboard,
  listarIncidenciasAdmin,
  listarConductoresAdmin,
  obtenerAlertasEmergenciaAdmin,
  obtenerAdminActual,
  type IndicadorAccionableDashboard
} from "@ruum/api/services";
import { CONFIG_ROL_ADMIN, normalizarRolAdmin, type RolAdminOperativo, type WidgetDashboardAdmin } from "../lib/roles-admin";
import type { Database } from "@ruum/shared/types";
import { useHybridRefresh } from "../hooks/useHybridRefresh";

type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];
type EstadoConexionDashboard = "datos_en_vivo" | "actualizando" | "reconectando" | "sin_conexion" | "desactualizado";

export type DashboardInitialData = {
  indicadores: IndicadorAccionableDashboard[];
  incidencias: IncidenciaRow[];
  emergencias: AuditoriaRow[];
  conductoresDocVencido: ConductorRow[];
  rol: RolAdminOperativo;
  cargadoEn: string;
};

const ACCIONES_FRECUENTES = [
  {
    etiqueta: "Programar traslado",
    detalle: "Desde archivo corporativo",
    href: "/masivos"
  },
  {
    etiqueta: "Asignar conductor",
    detalle: "En traslados sin conductor",
    href: "/viajes?filtro=sin_asignacion&accion=asignar_conductor"
  },
  {
    etiqueta: "Registrar incidencia",
    detalle: "En traslados activos",
    href: "/viajes?filtro=activos&accion=registrar_incidencia"
  }
] as const;

export default function DashboardCliente({ inicial }: { inicial: DashboardInitialData | null }) {
  const [indicadores, setIndicadores] = useState<IndicadorAccionableDashboard[]>(inicial?.indicadores ?? []);
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>(inicial?.incidencias ?? []);
  const [emergencias, setEmergencias] = useState<AuditoriaRow[]>(inicial?.emergencias ?? []);
  const [conductoresDocVencido, setConductoresDocVencido] = useState<ConductorRow[]>(inicial?.conductoresDocVencido ?? []);
  const [cargando, setCargando] = useState(!inicial);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(inicial ? new Date(inicial.cargadoEn) : null);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [estadoConexionDatos, setEstadoConexionDatos] = useState<EstadoConexionDashboard>(inicial ? "datos_en_vivo" : "actualizando");
  const [seccionesDesactualizadas, setSeccionesDesactualizadas] = useState<string[]>([]);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [rolAdmin, setRolAdmin] = useState<RolAdminOperativo>(inicial?.rol ?? "operador");
  const [errorOperacional, setErrorOperacional] = useState<string | null>(inicial ? null : "No pudimos obtener datos reales del dashboard. Verifica la sesión administrativa y la configuración de Supabase.");
  const ultimaRespuestaExitosaRef = useRef<Date | null>(inicial ? new Date(inicial.cargadoEn) : null);

  async function cargarDashboard(esRefresco = false, manual = false, activo = true) {
      if (!esRefresco) setCargando(true);
      if (manual) setActualizandoManual(true);
      if (!tieneSupabaseConfigurado()) {
        if (!activo) return;
        const teniaRespuestaExitosa = Boolean(ultimaRespuestaExitosaRef.current);
        if (!teniaRespuestaExitosa) {
          setIndicadores([]);
          setIncidencias([]);
          setEmergencias([]);
          setConductoresDocVencido([]);
        }
        setEstadoConexionDatos(teniaRespuestaExitosa ? "desactualizado" : "sin_conexion");
        setSeccionesDesactualizadas(["KPIs administrativos", "alertas operativas", "conductores"]);
        setErrorOperacional("Supabase no está configurado. El dashboard final no muestra datos demo; requiere una fuente administrativa real.");
        setCargando(false);
        setActualizandoManual(false);
        return;
      }

      try {
        if (esRefresco) setEstadoConexionDatos(ultimaRespuestaExitosaRef.current ? "reconectando" : "actualizando");
        const cliente = crearClienteNavegador();
        const [adminActual, indicadoresReales, incidenciasReales, conductoresReales, emergenciasReales] = await Promise.all([
          obtenerAdminActual(cliente),
          obtenerIndicadoresAccionablesDashboard(cliente),
          listarIncidenciasAdmin(cliente),
          listarConductoresAdmin(cliente),
          obtenerAlertasEmergenciaAdmin(cliente)
        ]);
        if (!activo) return;
        setIndicadores(indicadoresReales);
        setIncidencias(incidenciasReales.filter((i) => !i.resuelta));
        setEmergencias(emergenciasReales);
        setConductoresDocVencido(conductoresReales.filter((c) => !c.documentos_vigentes));
        setRolAdmin(normalizarRolAdmin(adminActual?.rol_operativo));
        const fecha = new Date();
        ultimaRespuestaExitosaRef.current = fecha;
        setUltimaSincronizacion(fecha);
        setEstadoConexionDatos("datos_en_vivo");
        setSeccionesDesactualizadas([]);
        setErrorOperacional(null);
      } catch (error) {
        const teniaRespuestaExitosa = Boolean(ultimaRespuestaExitosaRef.current);
        if (!activo) return;
        if (!teniaRespuestaExitosa) {
          setIndicadores([]);
          setIncidencias([]);
          setEmergencias([]);
          setConductoresDocVencido([]);
        }
        setEstadoConexionDatos(teniaRespuestaExitosa ? "desactualizado" : "sin_conexion");
        setSeccionesDesactualizadas(["KPIs administrativos", "alertas operativas", "conductores"]);
        setErrorOperacional(error instanceof Error ? error.message : "No pudimos obtener datos reales del dashboard.");
      } finally {
        if (activo) setCargando(false);
        if (activo) setActualizandoManual(false);
      }
  }

  useEffect(() => {
    let activo = true;
    if (!inicial) void cargarDashboard(false, false, activo);
    return () => { activo = false; };
  }, [inicial]);

  const refrescarHibrido = useCallback(() => cargarDashboard(true, false, true), []);
  useHybridRefresh({ refrescar: refrescarHibrido, intervaloRespaldoMs: 180_000 });

  useEffect(() => {
    setAhora(new Date());
    const intervalo = window.setInterval(() => setAhora(new Date()), 30000);
    return () => window.clearInterval(intervalo);
  }, []);

  const estadoOperacion = useMemo(() => {
    if (cargando) return "Sincronizando";
    if (emergencias.length > 0) return "Emergencia activa";
    if (incidencias.length > 0 || conductoresDocVencido.length > 0) return "Atención requerida";
    return "Operación estable";
  }, [cargando, conductoresDocVencido.length, emergencias.length, incidencias.length]);

  const turno = useMemo(() => {
    if (!ahora) return "Turno pendiente";
    const hora = ahora.getHours();
    if (hora >= 6 && hora < 14) return "Matutino";
    if (hora >= 14 && hora < 22) return "Vespertino";
    return "Nocturno";
  }, [ahora]);

  const configuracionRol = CONFIG_ROL_ADMIN[rolAdmin];
  const indicadoresVisibles = useMemo(() => {
    const orden = new Map(configuracionRol.indicadores.map((clave, indice) => [clave, indice]));
    return indicadores
      .filter((indicador) => orden.has(indicador.clave))
      .sort((a, b) => (orden.get(a.clave) ?? 99) - (orden.get(b.clave) ?? 99));
  }, [configuracionRol.indicadores, indicadores]);
  const actualizacionGlobal = useMemo(() => {
    const cortes = indicadores
      .map((indicador) => new Date(indicador.actualizadoEn))
      .filter((fecha) => Number.isFinite(fecha.getTime()));
    if (ultimaSincronizacion) cortes.push(ultimaSincronizacion);
    if (cortes.length === 0) return null;
    return new Date(Math.max(...cortes.map((fecha) => fecha.getTime())));
  }, [indicadores, ultimaSincronizacion]);
  const filtrosRapidos = useMemo(() => [
    { etiqueta: "Todos", href: "/viajes" },
    { etiqueta: "Sin asignación", href: "/viajes?filtro=sin_asignacion" },
    { etiqueta: "SLA", href: "/alertas-sla?categoria=sla_en_riesgo" },
    { etiqueta: turno, href: `/viajes?turno=${encodeURIComponent(turno.toLowerCase())}` }
  ], [turno]);
  const conexionGlobal = estadoConexionGlobal(estadoConexionDatos, actualizacionGlobal, ahora);

  return (
    <main className="admin-page-shell">
      <section className="rounded-card border border-border-default bg-surface-primary/90 px-4 py-5 shadow-[var(--ruum-shadow-1)] sm:px-5" aria-label="Cabecera operativa">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-[0.16em] text-signal">Torre de Control</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">Dashboard operativo</h1>
            <p className="mt-2 max-w-3xl font-body text-base text-text-secondary">{configuracionRol.descripcion}</p>
          </div>
          <div className="w-full rounded-card border border-border-default bg-surface-secondary px-4 py-4 shadow-[var(--ruum-shadow-1)] xl:max-w-xl" aria-label="Estado global del día">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Estado global del día</p>
                <div className={`mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 font-body text-sm font-semibold ${estadoOperacion === "Operación estable" ? "border-status-success/30 bg-status-success-soft text-status-success" : estadoOperacion === "Emergencia activa" ? "border-status-error/30 bg-status-error-soft text-status-error" : "border-status-warning/35 bg-status-warning-soft text-status-warning"}`}>
                  <span className={`inline-block size-2.5 rounded-full ${estadoOperacion === "Operación estable" ? "bg-status-success" : estadoOperacion === "Emergencia activa" ? "bg-status-error" : "bg-status-warning"}`} aria-hidden="true" />
                  {estadoOperacion}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void cargarDashboard(true, true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-signal bg-signal px-4 py-2 font-body text-admin-boton font-semibold text-ink transition-colors hover:bg-signal/90 focus:outline-none focus:ring-2 focus:ring-focus-default/30 disabled:cursor-wait disabled:opacity-70"
                disabled={actualizandoManual}
              >
                <span aria-hidden="true">↻</span>
                {actualizandoManual ? "Actualizando" : "Actualizar"}
              </button>
            </div>
            <dl className="mt-4 grid gap-2 font-body text-sm text-text-secondary sm:grid-cols-2">
              <DatoEstado etiqueta="Última actualización" valor={actualizacionGlobal ? formatoHoraCorta(actualizacionGlobal) : "Sin respuesta"} />
              <DatoEstado etiqueta="Rol / turno" valor={`${configuracionRol.etiqueta} · ${turno}`} />
              <DatoEstado etiqueta="Sincronización" valor={actualizacionGlobal ? textoActualizadoHace(actualizacionGlobal, ahora) : "Sin corte"} />
              <div className={`rounded-lg border px-3 py-2 ${conexionGlobal.clase}`}>
                <dt className="font-body text-xs font-semibold uppercase tracking-wide">Datos en vivo</dt>
                <dd className="mt-1 flex items-center gap-2 font-body text-sm font-semibold">
                  <span className={`inline-block size-2 rounded-full ${conexionGlobal.punto}`} aria-hidden="true" />
                  {conexionGlobal.etiqueta} · Auto-refresco 3 min
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <nav className="sticky top-0 z-20 mt-4 rounded-card border border-border-default bg-surface-primary/95 px-3 py-3 shadow-[var(--ruum-shadow-1)] backdrop-blur" aria-label="Filtros rápidos del dashboard">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Filtros superiores</span>
          {filtrosRapidos.map((filtro) => (
            <Link
              key={filtro.href}
              href={filtro.href}
              className="inline-flex min-h-11 items-center rounded-full border border-border-default bg-surface-secondary px-4 py-2 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink focus:outline-none focus:ring-2 focus:ring-focus-default/30"
            >
              {filtro.etiqueta}
            </Link>
          ))}
        </div>
      </nav>

      {errorOperacional && (
        <div className="mt-4">
          <Aviso tono="danger">{errorOperacional}</Aviso>
        </div>
      )}

      {seccionesDesactualizadas.length > 0 && (
        <div className="mt-4">
          <Aviso tono="atencion">Pueden estar desactualizadas: {seccionesDesactualizadas.join(", ")}.</Aviso>
        </div>
      )}

      {cargando ? (
        /* Ítem 11 — skeleton estructurado reemplaza "Cargando…" */
        <div className="mt-8" aria-label="Cargando datos del dashboard" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-card border border-ink/10 p-5">
                <div className="h-3 w-28 animate-pulse rounded bg-ink/8" />
                <div className="mt-3 h-8 w-16 animate-pulse rounded bg-ink/10" />
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-card border border-ink/10 p-5 space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-ink/8" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-ink/6" />
              ))}
            </div>
            <div className="rounded-card border border-ink/10 p-5 space-y-3">
              <div className="h-4 w-28 animate-pulse rounded bg-ink/8" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-card bg-ink/6" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {errorOperacional && indicadoresVisibles.length === 0 ? (
            <div className="mt-8">
              <AdminPanel className="p-5 sm:p-6">
                <h2 className="font-display text-base font-semibold">Datos no disponibles</h2>
                <p className="mt-2 font-body text-sm text-text-secondary">
                  El tablero está cerrado hasta recibir indicadores administrativos reales.
                </p>
              </AdminPanel>
            </div>
          ) : configuracionRol.widgets.map((widget) => renderWidgetDashboard(widget, {
            indicadoresVisibles,
            emergencias,
            incidencias,
            conductoresDocVencido
          }))}
        </>
      )}
    </main>
  );
}

function renderWidgetDashboard(
  widget: WidgetDashboardAdmin,
  contexto: {
    indicadoresVisibles: IndicadorAccionableDashboard[];
    emergencias: AuditoriaRow[];
    incidencias: IncidenciaRow[];
    conductoresDocVencido: ConductorRow[];
  }
) {
  if (widget === "indicadores") {
    const indicadorSinAsignacion = contexto.indicadoresVisibles.find((indicador) => indicador.clave === "sin_asignacion");
    return (
      <section key={widget} className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]" aria-label="Indicadores y acciones operativas">
        <div className="rounded-card border border-border-default bg-surface-primary p-4 shadow-[var(--ruum-shadow-1)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Métricas clave</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-ink">Prioridad operativa</h2>
            </div>
            <p className="font-body text-sm text-text-secondary">{contexto.indicadoresVisibles.length} indicadores activos</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {contexto.indicadoresVisibles.map((indicador) => (
              <IndicadorAccionable key={indicador.clave} indicador={indicador} />
            ))}
          </div>
        </div>
        <AccionesFrecuentes indicadorSinAsignacion={indicadorSinAsignacion} />
      </section>
    );
  }

  if (widget === "emergencias") {
    if (contexto.emergencias.length === 0) return null;
    return (
      <section key={widget} className="mt-8">
        <h2 className="font-display text-base font-semibold text-status-error">Emergencias prioritarias</h2>
        <div className="mt-3 space-y-2">
          {contexto.emergencias.map((evento) => (
            <Link key={evento.id} href={evento.traslado_id ? `/viajes/${evento.traslado_id}` : "/viajes"} className="block">
              <div className="rounded-lg border border-status-error/25 bg-status-error-soft px-4 py-3">
                <p className="font-body text-sm font-semibold text-status-error">Emergencia / 911 activada por conductor</p>
                <p className="mt-1 font-body text-xs text-text-secondary">
                  Traslado {evento.traslado_id?.slice(0, 8).toUpperCase() ?? "sin folio"} · {new Date(evento.timestamp).toLocaleString("es-MX")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (widget === "alertas_operativas") {
    const sistemaLimpio = contexto.incidencias.length === 0 && contexto.conductoresDocVencido.length === 0;
    return (
      <section key={widget} className="mt-8">
        <AdminPanel className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Feed operativo</p>
              <h2 className="mt-1 font-display text-base font-semibold">Alertas operativas</h2>
            </div>
            <Link href="/alertas-sla" className="inline-flex min-h-9 items-center rounded-lg border border-border-default px-3 py-1.5 font-body text-xs font-semibold text-text-secondary hover:border-signal/50 hover:text-ink">
              Historial
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {sistemaLimpio && (
              <div className="rounded-lg border border-status-success/30 bg-status-success-soft px-4 py-4">
                <p className="font-body text-sm font-semibold text-status-success">Sistema limpio: no hay alertas pendientes.</p>
                <p className="mt-1 font-body text-xs text-text-secondary">Puedes concentrarte en programar nuevos traslados; las incidencias abiertas y documentos bloqueantes aparecerán aquí cuando requieran intervención.</p>
              </div>
            )}
            {contexto.incidencias.map((i) => (
              <Link key={i.id} href={`/viajes/${i.traslado_id}`} className="block">
                <Aviso tono="atencion">Incidencia sin resolver: {i.descripcion}</Aviso>
              </Link>
            ))}
            {contexto.conductoresDocVencido.map((c) => (
              <Link key={c.id} href="/conductores" className="block">
                <Aviso tono="atencion">{c.nombre}: documentos vencidos o incompletos</Aviso>
              </Link>
            ))}
          </div>
        </AdminPanel>
      </section>
    );
  }

  return null;
}

function AccionesFrecuentes({ indicadorSinAsignacion }: { indicadorSinAsignacion?: IndicadorAccionableDashboard }) {
  const sinAsignacion = indicadorSinAsignacion?.valor ?? 0;
  return (
    <aside className="rounded-card border border-border-default bg-surface-primary p-4 shadow-[var(--ruum-shadow-1)]" aria-label="Acciones frecuentes">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Flujo operativo</p>
      <h2 className="mt-1 font-display text-lg font-semibold text-ink">Acciones frecuentes</h2>
      <div className="mt-4 grid gap-3">
        {ACCIONES_FRECUENTES.map((accion) => {
          const esAsignacion = accion.etiqueta === "Asignar conductor";
          const estaHabilitada = !esAsignacion || sinAsignacion > 0;
          const estado = esAsignacion
            ? sinAsignacion > 0
              ? `${sinAsignacion} pendiente${sinAsignacion === 1 ? "" : "s"}`
              : "Sin pendientes"
            : "Disponible";
          const clase = estaHabilitada
            ? esAsignacion && sinAsignacion > 0
              ? "border-status-warning/35 bg-status-warning-soft text-status-warning hover:border-status-warning/70"
              : "border-border-default bg-surface-secondary text-ink hover:border-signal/40"
            : "border-border-default bg-surface-secondary text-text-secondary";
          const contenido = (
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-body text-sm font-semibold">{accion.etiqueta}</span>
                <span className="mt-1 block font-body text-xs text-text-tertiary">{accion.detalle}</span>
              </span>
              <span className="rounded-full border border-current px-2 py-1 font-body text-[0.68rem] font-semibold uppercase tracking-wide">
                {estado}
              </span>
            </span>
          );
          if (!estaHabilitada) {
            return (
              <span key={accion.href} aria-disabled="true" className={`block rounded-card border px-4 py-3 ${clase}`}>
                {contenido}
              </span>
            );
          }
          return (
            <Link key={accion.href} href={accion.href} className={`block rounded-card border px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-focus-default/30 ${clase}`}>
              {contenido}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

function DatoEstado({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-primary px-3 py-2">
      <dt className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{etiqueta}</dt>
      <dd className="mt-1 font-body text-sm font-semibold text-ink">{valor}</dd>
    </div>
  );
}

function estadoConexionGlobal(estado: EstadoConexionDashboard, actualizacion: Date | null, ahora: Date | null) {
  const referencia = ahora ?? new Date();
  const minutos = actualizacion ? Math.floor((referencia.getTime() - actualizacion.getTime()) / 60000) : Number.POSITIVE_INFINITY;
  if (estado === "sin_conexion" || estado === "desactualizado" || minutos >= 5) {
    return {
      etiqueta: estado === "sin_conexion" ? "Sin conexión" : "Revisar conexión",
      clase: "border-status-error/30 bg-status-error-soft text-status-error",
      punto: "bg-status-error"
    };
  }
  if (estado === "actualizando" || estado === "reconectando" || minutos >= 3) {
    return {
      etiqueta: estado === "reconectando" ? "Reconectando" : "Sincronizando",
      clase: "border-status-warning/35 bg-status-warning-soft text-status-warning",
      punto: "bg-status-warning"
    };
  }
  return {
    etiqueta: "Conectado",
    clase: "border-status-success/30 bg-status-success-soft text-status-success",
    punto: "bg-status-success"
  };
}

function textoActualizadoHace(fecha: Date, ahora: Date | null) {
  const referencia = ahora ?? new Date();
  const segundos = Math.max(0, Math.floor((referencia.getTime() - fecha.getTime()) / 1000));
  if (segundos < 60) return `Hace ${segundos} segundos`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  return `Hace ${horas} horas`;
}

function IndicadorAccionable({ indicador }: { indicador: IndicadorAccionableDashboard }) {
  const estado = estadoKpi(indicador);

  return (
    <Link
      href={indicador.href}
      className="block min-h-60 rounded-card border border-border-default bg-surface-secondary p-4 shadow-[var(--ruum-shadow-1)] transition-colors hover:border-signal/40 focus:outline-none focus:ring-2 focus:ring-focus-default/30"
      aria-label={`${indicador.titulo}: ${indicador.valor}. Ver detalles`}
    >
      <div className="flex h-full flex-col">
        <p className="min-h-10 font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{indicador.titulo}</p>
        <div className="my-4 flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-display text-5xl font-bold leading-none text-ink">{indicador.valor}</p>
          <span className={`mt-3 rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${estado.badgeClase}`}>
            {estado.etiqueta}
          </span>
        </div>
        <dl className="grid gap-2 border-t border-ink/10 pt-3">
          <DatoKpi etiqueta="Tendencia" valor={formatoVariacion(indicador.variacion)} />
        <DatoKpi etiqueta="Umbral" valor={indicador.umbral} />
        <DatoKpi etiqueta="Clave operativa" valor={indicador.subgrupoCritico} />
        </dl>
        <span className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-status-info/35 bg-surface-primary px-3 py-2 font-body text-admin-boton font-semibold text-status-info">
          <span aria-hidden="true">▦</span>
          Ver detalles
        </span>
      </div>
    </Link>
  );
}

function estadoKpi(indicador: IndicadorAccionableDashboard) {
  const positivoEnCero = indicador.clave === "riesgo_sla" || indicador.clave === "con_incidencia" || indicador.clave === "sin_asignacion";
  if (indicador.valor === 0 && positivoEnCero) {
    return {
      positivoEnCero,
      etiqueta: indicador.clave === "sin_asignacion" ? "Todo asignado" : "Sin riesgo",
      badgeClase: "border-status-success/30 bg-surface-primary text-status-success"
    };
  }
  if (indicador.severidad === "critico") {
    return {
      positivoEnCero,
      etiqueta: "Crítico",
      badgeClase: "border-status-error/30 bg-surface-primary text-status-error"
    };
  }
  if (indicador.severidad === "atencion") {
    return {
      positivoEnCero,
      etiqueta: "Atención",
      badgeClase: "border-status-warning/35 bg-surface-primary text-status-warning"
    };
  }
  return {
    positivoEnCero,
    etiqueta: "Normal",
    badgeClase: "border-ink/10 bg-surface-secondary text-text-secondary"
  };
}

function DatoKpi({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="font-body text-admin-secundario text-text-tertiary">{etiqueta}</dt>
      <dd className="min-w-0 font-body text-admin-secundario font-semibold text-ink">{valor}</dd>
    </div>
  );
}

function formatoVariacion(valor: number) {
  if (valor > 0) return `+${valor}%`;
  if (valor < 0) return `${valor}%`;
  return "0%";
}

function formatoHoraCorta(valor: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City"
  }).format(valor);
}
