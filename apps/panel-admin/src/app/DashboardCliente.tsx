"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Aviso, PassportCard } from "@ruum/ui";
import { AdminPanel } from "./admin-ui";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../lib/supabase-browser";
import {
  obtenerIndicadoresAccionablesDashboard,
  listarIncidenciasAdmin,
  listarConductoresAdmin,
  obtenerAlertasEmergenciaAdmin,
  obtenerAdminActual,
  type IndicadorAccionableDashboard
} from "@ruum/api/services";
import { INCIDENCIAS_DEMO, CONDUCTORES_DEMO } from "../lib/datos-demo";
import { CONFIG_ROL_ADMIN, normalizarRolAdmin, type RolAdminOperativo, type WidgetDashboardAdmin } from "../lib/roles-admin";
import type { Database } from "@ruum/shared/types";
import { useHybridRefresh } from "../hooks/useHybridRefresh";

type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];
type EstadoConexionDashboard = "datos_en_vivo" | "actualizando" | "reconectando" | "sin_conexion" | "desactualizado" | "demo";

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

const INDICADORES_DEMO: IndicadorAccionableDashboard[] = [
  {
    clave: "traslados_activos",
    titulo: "Traslados activos",
    valor: 7,
    ventanaTemporal: "Ahora · operación abierta",
    variacion: 12,
    umbral: "Atención > 12 · crítico > 18",
    subgrupoCritico: "1 con incidencia",
    href: "/viajes?filtro=activos",
    severidad: "normal",
    actualizadoEn: new Date().toISOString()
  },
  {
    clave: "inician_60_min",
    titulo: "Inician en 60 minutos",
    valor: 2,
    ventanaTemporal: "Próximos 60 min",
    variacion: 0,
    umbral: "Atención > 3 · crítico > 6",
    subgrupoCritico: "1 sin conductor",
    href: "/viajes?filtro=inician_60",
    severidad: "normal",
    actualizadoEn: new Date().toISOString()
  },
  {
    clave: "sin_asignacion",
    titulo: "Sin asignación",
    valor: 2,
    ventanaTemporal: "Ahora · pendientes de conductor",
    variacion: 50,
    umbral: "Atención > 1 · crítico > 3",
    subgrupoCritico: "0 con más de 24 h",
    href: "/viajes?filtro=sin_asignacion",
    severidad: "atencion",
    actualizadoEn: new Date().toISOString()
  },
  {
    clave: "riesgo_sla",
    titulo: "En riesgo de SLA",
    valor: 3,
    ventanaTemporal: "Ahora · excepciones SLA",
    variacion: 0,
    umbral: "Atención > 0 · crítico si vencido",
    subgrupoCritico: "1 vencido",
    href: "/alertas-sla?categoria=sla_en_riesgo",
    severidad: "critico",
    actualizadoEn: new Date().toISOString()
  },
  {
    clave: "con_incidencia",
    titulo: "Con incidencia",
    valor: 1,
    ventanaTemporal: "Ahora · traslados activos",
    variacion: 0,
    umbral: "Atención > 0 · crítico > 2",
    subgrupoCritico: "0 documentación bloqueante",
    href: "/viajes?filtro=incidencia",
    severidad: "atencion",
    actualizadoEn: new Date().toISOString()
  },
  {
    clave: "finalizados_hoy",
    titulo: "Finalizados hoy",
    valor: 3,
    ventanaTemporal: "Hoy · 00:00 a ahora",
    variacion: 25,
    umbral: "Meta >= cierre del día anterior",
    subgrupoCritico: "2 ayer",
    href: "/viajes?filtro=finalizados_hoy",
    severidad: "normal",
    actualizadoEn: new Date().toISOString()
  }
];

export default function DashboardCliente({ inicial }: { inicial: DashboardInitialData | null }) {
  const router = useRouter();
  const [indicadores, setIndicadores] = useState<IndicadorAccionableDashboard[]>(inicial?.indicadores ?? []);
  const [incidencias, setIncidencias] = useState<IncidenciaRow[]>(inicial?.incidencias ?? []);
  const [emergencias, setEmergencias] = useState<AuditoriaRow[]>(inicial?.emergencias ?? []);
  const [conductoresDocVencido, setConductoresDocVencido] = useState<ConductorRow[]>(inicial?.conductoresDocVencido ?? []);
  const [esDemo, setEsDemo] = useState(false);
  const [cargando, setCargando] = useState(!inicial);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<Date | null>(inicial ? new Date(inicial.cargadoEn) : null);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [estadoConexionDatos, setEstadoConexionDatos] = useState<EstadoConexionDashboard>("actualizando");
  const [seccionesDesactualizadas, setSeccionesDesactualizadas] = useState<string[]>([]);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [comandoGlobal, setComandoGlobal] = useState("");
  const [avisoComando, setAvisoComando] = useState<string | null>(null);
  const [rolAdmin, setRolAdmin] = useState<RolAdminOperativo>(inicial?.rol ?? "operador");
  const ultimaRespuestaExitosaRef = useRef<Date | null>(null);

  async function cargarDashboard(esRefresco = false, manual = false, activo = true) {
      if (!esRefresco) setCargando(true);
      if (manual) setActualizandoManual(true);
      if (!tieneSupabaseConfigurado()) {
        if (!activo) return;
        setIndicadores(INDICADORES_DEMO.map((indicador) => ({ ...indicador, actualizadoEn: new Date().toISOString() })));
        setIncidencias(INCIDENCIAS_DEMO);
        setEmergencias([]);
        setConductoresDocVencido(CONDUCTORES_DEMO.filter((c) => !c.documentos_vigentes));
        setEsDemo(true);
        setRolAdmin("operador");
        const fecha = new Date();
        ultimaRespuestaExitosaRef.current = fecha;
        setUltimaSincronizacion(fecha);
        setEstadoConexionDatos("demo");
        setSeccionesDesactualizadas([]);
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
        setEsDemo(false);
        setRolAdmin(normalizarRolAdmin(adminActual?.rol_operativo));
        const fecha = new Date();
        ultimaRespuestaExitosaRef.current = fecha;
        setUltimaSincronizacion(fecha);
        setEstadoConexionDatos("datos_en_vivo");
        setSeccionesDesactualizadas([]);
      } catch {
        const teniaRespuestaExitosa = Boolean(ultimaRespuestaExitosaRef.current);
        if (puedeUsarDatosDemo()) {
          if (!activo) return;
          setIndicadores(INDICADORES_DEMO.map((indicador) => ({ ...indicador, actualizadoEn: new Date().toISOString() })));
          setIncidencias(INCIDENCIAS_DEMO);
          setEmergencias([]);
          setConductoresDocVencido(CONDUCTORES_DEMO.filter((c) => !c.documentos_vigentes));
          setEsDemo(true);
          setRolAdmin("operador");
          setEstadoConexionDatos(teniaRespuestaExitosa ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["KPIs administrativos", "alertas operativas", "conductores"]);
        } else {
          if (!activo) return;
          setIndicadores([]);
          setIncidencias([]);
          setEmergencias([]);
          setConductoresDocVencido([]);
          setEsDemo(false);
          setEstadoConexionDatos(teniaRespuestaExitosa ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["KPIs administrativos", "alertas operativas", "conductores"]);
        }
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

  function ejecutarComandoGlobal(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const comando = comandoGlobal.trim().toLowerCase();
    const destino = comando.includes("program") || comando.includes("crear") || comando.includes("masiv")
      ? ACCIONES_FRECUENTES[0].href
      : comando.includes("asign") || comando.includes("conductor")
        ? ACCIONES_FRECUENTES[1].href
        : comando.includes("incid")
          ? ACCIONES_FRECUENTES[2].href
          : null;
    if (!destino) {
      setAvisoComando("Comando no reconocido.");
      return;
    }
    setAvisoComando(null);
    router.push(destino);
  }

  return (
    <main className="admin-page-shell">
      <section className="rounded-card border border-border-default bg-surface-primary/90 px-4 py-4 shadow-[var(--ruum-shadow-1)] sm:px-5" aria-label="Cabecera operativa">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono-ruum text-admin-secundario uppercase tracking-[0.16em] text-signal">Centro de control</p>
            <h1 className="mt-1 font-display text-xl font-semibold text-ink">Dashboard operativo</h1>
            <p className="mt-1 font-body text-sm text-text-secondary">{configuracionRol.descripcion}</p>
          </div>
          <Link
            href="/viajes"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-signal px-4 py-2.5 font-body text-admin-boton font-semibold text-ink shadow-sm transition-colors hover:bg-signal/90"
          >
            Revisar traslados
          </Link>
          <button
            type="button"
            onClick={() => void cargarDashboard(true, true)}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2.5 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink"
            disabled={actualizandoManual}
          >
            {actualizandoManual ? "Actualizando" : "Actualizar"}
          </button>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <DatoCabecera etiqueta="Estado" valor={estadoOperacion} destacado={estadoOperacion !== "Operación estable"} />
          <DatoCabecera etiqueta="Conexión" valor={textoEstadoConexion(estadoConexionDatos)} destacado={estadoConexionDatos !== "datos_en_vivo"} />
          <DatoCabecera etiqueta="Actualización" valor={ultimaSincronizacion ? textoActualizadoHace(ultimaSincronizacion, ahora) : "Sin respuesta exitosa"} destacado={estadoConexionDatos === "desactualizado"} />
          <DatoCabecera etiqueta="Tipo de datos" valor="Administrativos" />
          <DatoCabecera etiqueta="Origen" valor={esDemo ? "Modo demo" : "Datos reales"} destacado={esDemo} />
          <DatoCabecera etiqueta="Turno" valor={turno} />
          <DatoCabecera etiqueta="Rol" valor={configuracionRol.etiqueta} />
        </dl>
      </section>

      {seccionesDesactualizadas.length > 0 && (
        <div className="mt-4">
          <Aviso tono="atencion">Pueden estar desactualizadas: {seccionesDesactualizadas.join(", ")}.</Aviso>
        </div>
      )}

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no la operación real.</Aviso>
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
          {configuracionRol.widgets.map((widget) => renderWidgetDashboard(widget, {
            indicadoresVisibles,
            emergencias,
            incidencias,
            conductoresDocVencido,
            comandoGlobal,
            avisoComando,
            setComandoGlobal,
            ejecutarComandoGlobal
          }))}
        </>
      )}
    </main>
  );
}

function DatoCabecera({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${destacado ? "border-status-warning/35 bg-status-warning-soft" : "border-ink/10 bg-surface-secondary"}`}>
      <dt className="font-body text-admin-secundario text-text-tertiary">{etiqueta}</dt>
      <dd className={`mt-1 font-body text-sm font-semibold ${destacado ? "text-status-warning" : "text-ink"}`}>{valor}</dd>
    </div>
  );
}

function renderWidgetDashboard(
  widget: WidgetDashboardAdmin,
  contexto: {
    indicadoresVisibles: IndicadorAccionableDashboard[];
    emergencias: AuditoriaRow[];
    incidencias: IncidenciaRow[];
    conductoresDocVencido: ConductorRow[];
    comandoGlobal: string;
    avisoComando: string | null;
    setComandoGlobal: (valor: string) => void;
    ejecutarComandoGlobal: (evento: FormEvent<HTMLFormElement>) => void;
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
        <form className="mt-4" onSubmit={contexto.ejecutarComandoGlobal}>
          <label className="sr-only" htmlFor="comando-global-admin">Comando global</label>
          <div className="flex gap-2">
            <input
              id="comando-global-admin"
              value={contexto.comandoGlobal}
              onChange={(evento) => contexto.setComandoGlobal(evento.target.value)}
              placeholder="Comando global"
              className="min-w-0 flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
            />
            <button
              type="submit"
              className="rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink"
            >
              Ejecutar
            </button>
          </div>
          {contexto.avisoComando && <p className="mt-2 font-body text-xs text-status-warning">{contexto.avisoComando}</p>}
        </form>
      </AdminPanel>
    </section>
  );
}

function textoEstadoConexion(estado: EstadoConexionDashboard) {
  if (estado === "datos_en_vivo") return "Datos en vivo";
  if (estado === "actualizando") return "Actualizando";
  if (estado === "reconectando") return "Reconectando";
  if (estado === "desactualizado") return "Posiblemente desactualizados";
  if (estado === "demo") return "Modo demo";
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
