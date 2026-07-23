"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Aviso, PassportCard } from "@ruum/ui";
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
    detalle: "Carga corporativa o masiva",
    href: "/masivos"
  },
  {
    etiqueta: "Asignar conductor",
    detalle: "Traslados sin conductor",
    href: "/viajes?filtro=sin_asignacion&accion=asignar_conductor"
  },
  {
    etiqueta: "Registrar incidencia",
    detalle: "Traslado activo",
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
    const hora = ahora?.getHours() ?? new Date().getHours();
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

  return (
    <main className="admin-page-shell">
      <section className="rounded-card border border-border-default bg-surface-primary/90 px-4 py-4 shadow-[var(--ruum-shadow-1)] sm:px-5" aria-label="Cabecera operativa">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-[0.16em] text-signal">Torre de Control</p>
            <h1 className="mt-1 font-display text-xl font-semibold text-ink">Dashboard operativo</h1>
            <p className="mt-1 font-body text-sm text-text-secondary">{configuracionRol.descripcion}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href="/viajes"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-body text-admin-boton font-semibold text-ink shadow-sm transition-colors hover:bg-signal/90"
            >
              Revisar traslados
            </Link>
            <button
              type="button"
              onClick={() => void cargarDashboard(true, true)}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink"
              disabled={actualizandoManual}
            >
              {actualizandoManual ? "Actualizando" : "Actualizar"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-body text-sm text-text-secondary">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${estadoOperacion === "Operación estable" ? "text-status-success" : estadoOperacion === "Emergencia activa" ? "text-status-error" : "text-status-warning"}`}>
            <span className={`inline-block size-2 rounded-full ${estadoOperacion === "Operación estable" ? "bg-status-success" : estadoOperacion === "Emergencia activa" ? "bg-status-error" : "bg-status-warning"}`} aria-hidden="true" />
            {estadoOperacion}
          </span>
          <span className="text-text-tertiary">·</span>
          <span>{textoEstadoConexion(estadoConexionDatos)}</span>
          <span className="text-text-tertiary">·</span>
          <span>{ultimaSincronizacion ? textoActualizadoHace(ultimaSincronizacion, ahora) : "Sin respuesta"}</span>
          <span className="text-text-tertiary">·</span>
          <span>{configuracionRol.etiqueta}</span>
          <span className="text-text-tertiary">·</span>
          <span>{turno}</span>
        </div>
      </section>

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
    return (
      <section key={widget} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Indicadores accionables">
        {contexto.indicadoresVisibles.map((indicador) => (
          <IndicadorAccionable key={indicador.clave} indicador={indicador} />
        ))}
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
    return (
      <section key={widget} className="mt-8">
        <AdminPanel className="p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold">Alertas operativas</h2>
          <div className="mt-3 space-y-2">
            {contexto.incidencias.length === 0 && contexto.conductoresDocVencido.length === 0 && (
              <p className="font-body text-sm text-text-tertiary">Sin alertas por ahora.</p>
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

  return (
    <section key={widget} className="mt-8">
      <AdminPanel className="p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold">Acciones frecuentes</h2>
        <div className="mt-3 grid gap-3">
          {ACCIONES_FRECUENTES.map((accion) => (
            <Link key={accion.href} href={accion.href}>
              <PassportCard className="transition-shadow hover:border-signal/40 hover:shadow-md">
                <p className="font-body text-sm font-semibold text-ink">{accion.etiqueta}</p>
                <p className="mt-1 font-body text-xs text-text-tertiary">{accion.detalle}</p>
              </PassportCard>
            </Link>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}

function textoEstadoConexion(estado: EstadoConexionDashboard) {
  if (estado === "datos_en_vivo") return "Datos en vivo";
  if (estado === "actualizando") return "Actualizando";
  if (estado === "reconectando") return "Reconectando";
  if (estado === "desactualizado") return "Posiblemente desactualizados";
  return "Sin conexión";
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
  const clase = {
    normal: "border-border-default bg-surface-primary hover:border-signal/35",
    atencion: "border-status-warning/35 bg-status-warning-soft hover:border-status-warning/70",
    critico: "border-status-error/35 bg-status-error-soft hover:border-status-error/70"
  }[indicador.severidad];
  const claseValor = indicador.severidad === "critico"
    ? "text-status-error"
    : indicador.severidad === "atencion"
      ? "text-status-warning"
      : "text-ink";

  return (
    <Link
      href={indicador.href}
      className={`block rounded-card border p-4 shadow-[var(--ruum-shadow-1)] transition-colors ${clase}`}
      aria-label={`${indicador.titulo}: ${indicador.valor}. Abrir vista filtrada`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{indicador.titulo}</p>
          <p className={`mt-2 font-display text-4xl font-bold leading-none ${claseValor}`}>{indicador.valor}</p>
        </div>
        <span className="rounded-full border border-ink/10 bg-surface-primary px-2.5 py-1 font-body text-xs font-semibold text-text-secondary">
          {formatoVariacion(indicador.variacion)}
        </span>
      </div>
      <dl className="mt-4 grid gap-2 border-t border-ink/10 pt-3">
        <DatoKpi etiqueta="Ventana" valor={indicador.ventanaTemporal} />
        <DatoKpi etiqueta="Corte" valor={formatoCorteIndicador(indicador.actualizadoEn)} />
        <DatoKpi etiqueta="Umbral" valor={indicador.umbral} />
        <DatoKpi etiqueta="Subgrupo crítico" valor={indicador.subgrupoCritico} />
      </dl>
      <p className="mt-3 font-body text-xs font-semibold text-status-info">Abrir listado filtrado</p>
    </Link>
  );
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

function formatoCorteIndicador(valor: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(valor));
}
