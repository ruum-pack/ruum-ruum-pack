"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { listarIncidenciasAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminPageHeader, AdminPanel, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminButton, AdminErrorState, AdminLoadingState, AdminTooltip } from "../admin-components";

type Incidencia = Database["public"]["Tables"]["incidencias"]["Row"];
type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "demo";
type FiltroTipo = "todos" | "abiertas" | "vehiculo_no_enciende" | "contacto_no_localizado" | "documentacion_incompleta" | "dano_previo_relevante";
type FiltroOrigen = "todos" | "traslado" | "usuario" | "vehiculo" | "empresa";
type FiltroResponsable = "todos" | "operacion" | "torre_control" | "documentacion" | "seguros";
type GravedadIncidencia = "leve" | "media" | "grave";
type FiltroGravedad = "todos" | GravedadIncidencia;

const TIPOS: Array<Exclude<FiltroTipo, "todos" | "abiertas">> = [
  "vehiculo_no_enciende",
  "contacto_no_localizado",
  "documentacion_incompleta",
  "dano_previo_relevante"
];

const FILTROS_TIPO: Array<{ valor: FiltroTipo; etiqueta: string }> = [
  { valor: "abiertas", etiqueta: "Abiertas" },
  { valor: "vehiculo_no_enciende", etiqueta: "Vehículo no enciende" },
  { valor: "contacto_no_localizado", etiqueta: "Contacto no localizado" },
  { valor: "documentacion_incompleta", etiqueta: "Documentación incompleta" },
  { valor: "dano_previo_relevante", etiqueta: "Daño previo relevante" },
  { valor: "todos", etiqueta: "Historial completo" }
];

const FILTROS_ORIGEN: Array<{ valor: FiltroOrigen; etiqueta: string }> = [
  { valor: "todos", etiqueta: "Todos los orígenes" },
  { valor: "traslado", etiqueta: "Traslado" },
  { valor: "usuario", etiqueta: "Usuario" },
  { valor: "vehiculo", etiqueta: "Vehículo" },
  { valor: "empresa", etiqueta: "Empresa" }
];

const FILTROS_RESPONSABLE: Array<{ valor: FiltroResponsable; etiqueta: string }> = [
  { valor: "todos", etiqueta: "Todos los responsables" },
  { valor: "operacion", etiqueta: "Operación" },
  { valor: "torre_control", etiqueta: "Torre de Control" },
  { valor: "documentacion", etiqueta: "Documentación" },
  { valor: "seguros", etiqueta: "Seguros" }
];

const FILTROS_GRAVEDAD: Array<{ valor: FiltroGravedad; etiqueta: string }> = [
  { valor: "todos", etiqueta: "Todas las gravedades" },
  { valor: "grave", etiqueta: "Grave" },
  { valor: "media", etiqueta: "Media" },
  { valor: "leve", etiqueta: "Leve" }
];

const RESPONSABLES_ASIGNABLES = FILTROS_RESPONSABLE.filter((item) => item.valor !== "todos");

const INCIDENCIAS_DEMO: Incidencia[] = [
  {
    id: "INC-2026-0048",
    traslado_id: "demo-admin-002",
    tipo: "dano_previo_relevante",
    momento: "entrega",
    reportada_por: "conductor",
    creada_en: "2026-06-29T14:42:00.000Z",
    descripcion: "El kilometraje final no coincide con el registro inicial y falta foto clara del tablero.",
    resuelta: false,
    resuelta_en: null
  },
  {
    id: "INC-2026-0049",
    traslado_id: "demo-admin-001",
    tipo: "contacto_no_localizado",
    momento: "recoleccion",
    reportada_por: "admin",
    creada_en: "2026-06-29T16:15:00.000Z",
    descripcion: "La persona de entrega no responde teléfono ni WhatsApp autorizado.",
    resuelta: false,
    resuelta_en: null
  },
  {
    id: "INC-2026-0050",
    traslado_id: "demo-admin-003",
    tipo: "documentacion_incompleta",
    momento: "post_cierre",
    reportada_por: "admin",
    creada_en: "2026-06-30T09:10:00.000Z",
    descripcion: "Pago retenido por diferencia entre tarifa final y gasto autorizado.",
    resuelta: false,
    resuelta_en: null
  }
];

const CLASE_BADGE = {
  estado: {
    abierta: "border-status-warning/35 bg-status-warning-soft text-status-warning",
    resuelta: "border-status-success/30 bg-status-success-soft text-status-success"
  },
  gravedad: {
    leve: "border-status-info/30 bg-status-info-soft text-status-info",
    media: "border-status-warning/35 bg-status-warning-soft text-status-warning",
    grave: "border-status-error/30 bg-status-error-soft text-status-error"
  }
} as const;

function etiquetaTipo(tipo: string) {
  return tipo.replaceAll("_", " ");
}

function etiquetaResponsable(responsable: FiltroResponsable) {
  return FILTROS_RESPONSABLE.find((item) => item.valor === responsable)?.etiqueta ?? "Sin asignar";
}

function etiquetaOrigen(origen: FiltroOrigen) {
  return FILTROS_ORIGEN.find((item) => item.valor === origen)?.etiqueta ?? "Origen";
}

function origenInferido(incidencia: Incidencia): Exclude<FiltroOrigen, "todos"> {
  if (incidencia.tipo === "vehiculo_no_enciende" || incidencia.tipo === "dano_previo_relevante") return "vehiculo";
  if (incidencia.tipo === "documentacion_incompleta") return "usuario";
  if (!incidencia.traslado_id) return "empresa";
  return "traslado";
}

function responsableSugerido(incidencia: Incidencia): Exclude<FiltroResponsable, "todos"> {
  if (incidencia.tipo === "documentacion_incompleta") return "documentacion";
  if (incidencia.tipo === "dano_previo_relevante") return "seguros";
  if (incidencia.reportada_por === "admin") return "torre_control";
  return "operacion";
}

function gravedadIncidencia(incidencia: Incidencia): GravedadIncidencia {
  if (incidencia.tipo === "dano_previo_relevante" || incidencia.tipo === "vehiculo_no_enciende") return "grave";
  if (incidencia.tipo === "contacto_no_localizado" || incidencia.tipo === "documentacion_incompleta") return "media";
  return "leve";
}

function horasTranscurridas(fechaIso: string, ahora: Date) {
  return Math.max(0, (ahora.getTime() - new Date(fechaIso).getTime()) / 3_600_000);
}

function formatoDuracion(horas: number) {
  if (horas < 1) return "menos de 1 h";
  if (horas < 24) return `${Math.floor(horas)} h`;
  return `${Math.floor(horas / 24)} d ${Math.floor(horas % 24)} h`;
}

function slaObjetivoHoras(gravedad: GravedadIncidencia) {
  if (gravedad === "grave") return 2;
  if (gravedad === "media") return 8;
  return 24;
}

function slaIncidencia(incidencia: Incidencia, ahora: Date) {
  if (incidencia.resuelta) return { texto: "SLA cerrado", enRiesgo: false, vencido: false };
  const gravedad = gravedadIncidencia(incidencia);
  const objetivo = slaObjetivoHoras(gravedad);
  const horas = horasTranscurridas(incidencia.creada_en, ahora);
  const restante = objetivo - horas;
  return {
    texto: restante > 0 ? `${formatoDuracion(restante)} restantes` : `${formatoDuracion(Math.abs(restante))} vencido`,
    enRiesgo: horas / objetivo >= 0.8,
    vencido: restante <= 0
  };
}

function fechaCompacta(fecha: Date) {
  return fecha.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", " ·");
}

function fechaCompleta(fecha: Date) {
  return fecha.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "medium" });
}

function KpiIncidencia({ etiqueta, valor, detalle, tono = "neutral" }: { etiqueta: string; valor: number | string; detalle: string; tono?: "neutral" | "alerta" | "exito" }) {
  const clase = tono === "alerta"
    ? "border-status-error/25 bg-status-error-soft"
    : tono === "exito"
      ? "border-status-success/25 bg-status-success-soft"
      : "border-border-default bg-surface-primary";
  return (
    <AdminPanel className={`p-4 ${clase}`}>
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">{etiqueta}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-ink">{valor}</p>
      <p className="mt-1 font-body text-xs text-text-secondary">{detalle}</p>
    </AdminPanel>
  );
}

function BadgeIncidencia({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-2 rounded-full border px-3 py-1 font-body text-xs font-semibold ${className}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

function ChipFiltroIncidencia({ activo, etiqueta, contador, onClick }: { activo: boolean; etiqueta: string; contador: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={[
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 font-body text-admin-boton font-semibold transition-colors",
        activo ? "border-signal bg-signal-soft text-ink shadow-[inset_0_0_0_1px_rgba(216,167,74,0.18)]" : "border-border-default bg-surface-primary text-text-secondary hover:border-signal/45 hover:text-ink"
      ].join(" ")}
    >
      <span>{etiqueta}</span>
      <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono-ruum text-[11px] text-ink">{contador}</span>
    </button>
  );
}

function EmptyIncidencias({ onLimpiar, onHistorial }: { onLimpiar: () => void; onHistorial: () => void }) {
  return (
    <section className="rounded-card border border-dashed border-border-default bg-surface-primary px-6 py-10 text-center" aria-live="polite">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-signal/25 bg-signal-soft">
        <span className="block size-3 rounded-full bg-signal" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold text-ink">No hay incidencias abiertas bajo este criterio.</h2>
      <p className="mx-auto mt-2 max-w-md font-body text-sm text-text-secondary">La bandeja queda limpia para este segmento operativo.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <AdminButton variant="secondary" onClick={onLimpiar}>Limpiar filtros</AdminButton>
        <AdminButton onClick={onHistorial}>Ver historial completo</AdminButton>
      </div>
    </section>
  );
}

function FiltroSelect<T extends string>({
  label,
  value,
  opciones,
  onChange
}: {
  label: string;
  value: T;
  opciones: Array<{ valor: T; etiqueta: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex min-w-56 flex-col gap-1 font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-10 rounded-lg border border-border-default bg-surface-primary px-3 py-2 font-body text-sm font-semibold normal-case tracking-normal text-ink outline-none transition-colors focus:border-signal"
      >
        {opciones.map((item) => (
          <option key={item.valor} value={item.valor}>{item.etiqueta}</option>
        ))}
      </select>
    </label>
  );
}

function IncidenciaCard({
  incidencia,
  ahora,
  responsable,
  onResponsable,
  onAccion
}: {
  incidencia: Incidencia;
  ahora: Date;
  responsable: Exclude<FiltroResponsable, "todos"> | "";
  onResponsable: (value: Exclude<FiltroResponsable, "todos">) => void;
  onAccion: (accion: string) => void;
}) {
  const gravedad = gravedadIncidencia(incidencia);
  const origen = origenInferido(incidencia);
  const sla = slaIncidencia(incidencia, ahora);
  const estado = incidencia.resuelta ? "resuelta" : "abierta";
  const trasladoHref = incidencia.traslado_id ? `/viajes/${incidencia.traslado_id}` : "/viajes";
  return (
    <AdminPanel className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono-ruum text-xs uppercase tracking-wide text-text-tertiary">Caso {incidencia.id.slice(0, 16).toUpperCase()}</p>
          <h2 className="mt-1 font-display text-xl font-semibold capitalize text-ink">{etiquetaTipo(incidencia.tipo)}</h2>
          <p className="mt-2 max-w-3xl font-body text-sm text-text-secondary">{incidencia.descripcion}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <BadgeIncidencia className={CLASE_BADGE.estado[estado]}>{incidencia.resuelta ? "Resuelta" : "Abierta"}</BadgeIncidencia>
          <BadgeIncidencia className={CLASE_BADGE.gravedad[gravedad]}>{gravedad}</BadgeIncidencia>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Origen</dt>
          <dd className="mt-1 font-body text-sm font-medium">{etiquetaOrigen(origen)}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Creación</dt>
          <dd className="mt-1 font-body text-sm font-medium">{new Date(incidencia.creada_en).toLocaleString("es-MX")}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Transcurrido</dt>
          <dd className="mt-1 font-mono-ruum text-sm font-medium">{formatoDuracion(horasTranscurridas(incidencia.creada_en, ahora))}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">SLA</dt>
          <dd className={`mt-1 font-body text-sm font-semibold ${sla.vencido || sla.enRiesgo ? "text-status-error" : "text-status-success"}`}>{sla.texto}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Reportada por</dt>
          <dd className="mt-1 font-body text-sm font-medium capitalize">{incidencia.reportada_por}</dd>
        </div>
        <div>
          <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Momento</dt>
          <dd className="mt-1 font-body text-sm font-medium capitalize">{incidencia.momento.replaceAll("_", " ")}</dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,280px)_1fr] lg:items-end">
        <label className="flex flex-col gap-1 font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          Responsable
          <select
            value={responsable}
            onChange={(event) => onResponsable(event.target.value as Exclude<FiltroResponsable, "todos">)}
            className="min-h-10 rounded-lg border border-border-default bg-surface-primary px-3 py-2 font-body text-sm font-semibold normal-case tracking-normal text-ink outline-none transition-colors focus:border-signal"
          >
            <option value="">Seleccionar operador</option>
            {RESPONSABLES_ASIGNABLES.map((item) => (
              <option key={item.valor} value={item.valor}>{item.etiqueta}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link href={trasladoHref} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-default px-4 py-2 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink">
            Ver origen
          </Link>
          <AdminButton variant="quiet" type="button" onClick={() => onAccion("Escalamiento registrado en vista")}>Escalar</AdminButton>
          <AdminButton variant="quiet" type="button" onClick={() => onAccion("Resolución preparada en vista")}>Resolver</AdminButton>
          <AdminButton variant="quiet" type="button" onClick={() => onAccion("Cierre preparado en vista")}>Cerrar</AdminButton>
          <AdminTooltip label="Este registro no tiene evidencia adjunta en la bandeja actual.">
            <span>
              <AdminButton variant="quiet" type="button" disabled>Vista previa evidencia</AdminButton>
            </span>
          </AdminTooltip>
        </div>
      </div>

      {!responsable && (
        <p className="mt-3 font-body text-xs text-text-tertiary">
          Responsable sugerido: {etiquetaResponsable(responsableSugerido(incidencia))}. La asignación rápida queda visible para operar sin abrir el detalle.
        </p>
      )}
    </AdminPanel>
  );
}

export default function PaginaIncidenciasAdmin() {
  const [tipo, setTipo] = useState<FiltroTipo>("abiertas");
  const [origen, setOrigen] = useState<FiltroOrigen>("todos");
  const [responsableFiltro, setResponsableFiltro] = useState<FiltroResponsable>("todos");
  const [gravedadFiltro, setGravedadFiltro] = useState<FiltroGravedad>("todos");
  const [responsables, setResponsables] = useState<Record<string, Exclude<FiltroResponsable, "todos"> | "">>({});
  const [mensajeAccion, setMensajeAccion] = useState<string | null>(null);
  const [incidencias, setIncidencias] = useState<Incidencia[]>(INCIDENCIAS_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const ahora = useMemo(() => ultimaActualizacion ?? new Date(), [ultimaActualizacion]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filtroUrl = params.get("filtro");
    const tipoUrl = params.get("tipo");
    const gravedadUrl = params.get("gravedad");
    if (filtroUrl === "abiertas") setTipo("abiertas");
    if (filtroUrl === "historial") setTipo("todos");
    if (FILTROS_TIPO.some((item) => item.valor === tipoUrl)) setTipo(tipoUrl as FiltroTipo);
    if (FILTROS_GRAVEDAD.some((item) => item.valor === gravedadUrl)) setGravedadFiltro(gravedadUrl as FiltroGravedad);
  }, []);

  const cargar = useCallback(async (manual = false) => {
    if (manual) setActualizandoManual(true);
    else setCargando(true);

    if (!tieneSupabaseConfigurado()) {
      setIncidencias(INCIDENCIAS_DEMO);
      setEsDemo(true);
      setError(null);
      setEstadoConexion("demo");
      setUltimaActualizacion(new Date());
      setCargando(false);
      setActualizandoManual(false);
      return;
    }

    try {
      setError(null);
      setIncidencias(await listarIncidenciasAdmin(crearClienteNavegador()));
      setEsDemo(false);
      setEstadoConexion("datos_en_vivo");
      setUltimaActualizacion(new Date());
    } catch {
      if (puedeUsarDatosDemo()) {
        setIncidencias(INCIDENCIAS_DEMO);
        setEsDemo(true);
        setError(null);
        setEstadoConexion("demo");
        setUltimaActualizacion(new Date());
      } else {
        setIncidencias([]);
        setEsDemo(false);
        setError("No pudimos cargar las incidencias.");
        setEstadoConexion("sin_conexion");
      }
    } finally {
      setCargando(false);
      setActualizandoManual(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conteosTipo = useMemo(() => {
    const conteos = Object.fromEntries(FILTROS_TIPO.map((item) => [item.valor, 0])) as Record<FiltroTipo, number>;
    conteos.todos = incidencias.length;
    conteos.abiertas = incidencias.filter((incidencia) => !incidencia.resuelta).length;
    for (const incidencia of incidencias) {
      if (TIPOS.includes(incidencia.tipo as Exclude<FiltroTipo, "todos" | "abiertas">)) {
        conteos[incidencia.tipo as Exclude<FiltroTipo, "todos" | "abiertas">] += 1;
      }
    }
    return conteos;
  }, [incidencias]);

  const visibles = useMemo(() => incidencias.filter((incidencia) => {
    const responsableActual = responsables[incidencia.id] || responsableSugerido(incidencia);
    const coincideTipo = tipo === "todos" || (tipo === "abiertas" ? !incidencia.resuelta : incidencia.tipo === tipo);
    const coincideOrigen = origen === "todos" || origenInferido(incidencia) === origen;
    const coincideResponsable = responsableFiltro === "todos" || responsableActual === responsableFiltro;
    const coincideGravedad = gravedadFiltro === "todos" || gravedadIncidencia(incidencia) === gravedadFiltro;
    return coincideTipo && coincideOrigen && coincideResponsable && coincideGravedad;
  }), [gravedadFiltro, incidencias, origen, responsableFiltro, responsables, tipo]);

  const kpis = useMemo(() => {
    const abiertas = incidencias.filter((incidencia) => !incidencia.resuelta);
    const promedioHoras = abiertas.length
      ? abiertas.reduce((total, incidencia) => total + horasTranscurridas(incidencia.creada_en, ahora), 0) / abiertas.length
      : 0;
    const hoy = ahora.toISOString().slice(0, 10);
    return {
      abiertas: abiertas.length,
      promedio: formatoDuracion(promedioHoras),
      enRiesgo: abiertas.filter((incidencia) => slaIncidencia(incidencia, ahora).enRiesgo).length,
      sinAsignar: abiertas.filter((incidencia) => !responsables[incidencia.id]).length,
      resueltasHoy: incidencias.filter((incidencia) => incidencia.resuelta_en?.startsWith(hoy)).length
    };
  }, [ahora, incidencias, responsables]);

  function limpiarFiltros() {
    setTipo("abiertas");
    setOrigen("todos");
    setResponsableFiltro("todos");
    setGravedadFiltro("todos");
    limpiarParamsFiltroUrl();
  }

  function verHistorialCompleto() {
    setTipo("todos");
    setOrigen("todos");
    setResponsableFiltro("todos");
    setGravedadFiltro("todos");
    limpiarParamsFiltroUrl();
  }

  function contextoFiltro() {
    if (tipo === "abiertas" && origen === "todos" && responsableFiltro === "todos") {
      return "Las incidencias abiertas accionables son aquellas que requieren intervención inmediata del equipo operativo.";
    }
    const partes = [
      tipo === "todos" ? "historial completo" : FILTROS_TIPO.find((item) => item.valor === tipo)?.etiqueta,
      origen !== "todos" ? `origen ${etiquetaOrigen(origen).toLowerCase()}` : null,
      responsableFiltro !== "todos" ? `responsable ${etiquetaResponsable(responsableFiltro).toLowerCase()}` : null,
      gravedadFiltro !== "todos" ? `gravedad ${gravedadFiltro}` : null
    ].filter(Boolean);
    return `Vista filtrada por ${partes.join(", ")}.`;
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Riesgos y cumplimiento"
        titulo="Incidencias"
        descripcion="Bandeja operativa para priorizar casos abiertos, SLA, responsables internos y origen del riesgo."
        estadoConexion={estadoConexion}
        tipoDatos="administrativos"
        contadorResultados={visibles.length}
        accion={(
          <div className="flex flex-wrap items-center gap-2">
            {ultimaActualizacion && (
              <AdminTooltip label={fechaCompleta(ultimaActualizacion)}>
                <span className="inline-flex min-h-10 items-center rounded-lg border border-border-default bg-surface-primary px-3 py-2 font-body text-xs font-semibold text-text-secondary">
                  Actualizado: {fechaCompacta(ultimaActualizacion)}
                </span>
              </AdminTooltip>
            )}
            <AdminButton variant="secondary" loading={actualizandoManual} onClick={() => void cargar(true)}>
              Actualizar
            </AdminButton>
          </div>
        )}
      />

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiIncidencia etiqueta="Abiertas / activas" valor={kpis.abiertas} detalle={`Promedio transcurrido: ${kpis.promedio}`} />
        <KpiIncidencia etiqueta="En riesgo de SLA" valor={kpis.enRiesgo} detalle="Requieren atencion prioritaria" tono={kpis.enRiesgo > 0 ? "alerta" : "neutral"} />
        <KpiIncidencia etiqueta="Sin asignar" valor={kpis.sinAsignar} detalle="Casos abiertos sin responsable confirmado" tono={kpis.sinAsignar > 0 ? "alerta" : "neutral"} />
        <KpiIncidencia etiqueta="Resueltas hoy" valor={kpis.resueltasHoy} detalle="Cierres registrados durante el dia" tono="exito" />
      </section>

      <div className="mt-4">
        <Aviso tono={esDemo ? "info" : "atencion"}>
          {esDemo ? "Vista con datos de ejemplo para operación administrativa." : "Incidencias reales de la operación."}
        </Aviso>
      </div>

      {mensajeAccion && (
        <div className="mt-4">
          <Aviso tono="info">{mensajeAccion}. Esta acción visual aún no persiste cambios en Supabase.</Aviso>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <AdminErrorState
            description={error}
            action={(
              <AdminButton variant="secondary" onClick={() => void cargar(true)}>
                Reintentar
              </AdminButton>
            )}
          />
        </div>
      )}

      <section className="mt-6">
        <AdminPanel className="p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-wide text-text-tertiary">Bandeja de casos</p>
              <p className="mt-1 font-body text-sm text-text-secondary">{contextoFiltro()}</p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros por tipo de incidencia">
              {FILTROS_TIPO.map((item) => (
                <ChipFiltroIncidencia
                  key={item.valor}
                  activo={tipo === item.valor}
                  etiqueta={item.etiqueta}
                  contador={conteosTipo[item.valor]}
                  onClick={() => setTipo(item.valor)}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <FiltroSelect label="Origen" value={origen} opciones={FILTROS_ORIGEN} onChange={setOrigen} />
              <FiltroSelect label="Responsable" value={responsableFiltro} opciones={FILTROS_RESPONSABLE} onChange={setResponsableFiltro} />
              <FiltroSelect label="Gravedad" value={gravedadFiltro} opciones={FILTROS_GRAVEDAD} onChange={setGravedadFiltro} />
            </div>
          </div>
        </AdminPanel>
      </section>

      <section className="mt-6 grid gap-4">
        {cargando && <AdminLoadingState label="Cargando incidencias" />}
        {!cargando && visibles.length === 0 && <EmptyIncidencias onLimpiar={limpiarFiltros} onHistorial={verHistorialCompleto} />}
        {!cargando && visibles.map((incidencia) => (
          <IncidenciaCard
            key={incidencia.id}
            incidencia={incidencia}
            ahora={ahora}
            responsable={responsables[incidencia.id] ?? ""}
            onResponsable={(value) => {
              setResponsables((actuales) => ({ ...actuales, [incidencia.id]: value }));
              setMensajeAccion(`Responsable seleccionado: ${etiquetaResponsable(value)}`);
            }}
            onAccion={(accion) => setMensajeAccion(accion)}
          />
        ))}
      </section>
    </main>
  );
}
