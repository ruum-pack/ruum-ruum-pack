"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, Button } from "@ruum/ui";
import { AdminPageHeader, AdminPanel } from "../admin-ui";
import {
  actualizarAlertaSlaAdmin,
  listarExcepcionesCriticasAdmin,
  type CategoriaExcepcionCritica,
  type ExcepcionCriticaAdmin,
  type SeveridadExcepcionCritica
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

const RESPONSABLES = [
  "Torre de Control",
  "Supervisor",
  "Asignación",
  "Monitoreo",
  "Documentos",
  "Soporte",
  "Incidencias"
];

const ETIQUETA_CATEGORIA: Record<CategoriaExcepcionCritica, string> = {
  emergencia: "Emergencias",
  sla_vencido: "SLA vencido",
  sla_en_riesgo: "SLA en riesgo",
  traslado_sin_conductor: "Traslado sin conductor",
  conductor_sin_senal: "Conductor sin señal",
  desviacion_ruta: "Desviación de ruta",
  incidencia_sin_responsable: "Incidencia sin responsable",
  documentacion_bloqueante: "Documentación bloqueante"
};

const ORDEN_CATEGORIAS: CategoriaExcepcionCritica[] = [
  "emergencia",
  "sla_vencido",
  "sla_en_riesgo",
  "traslado_sin_conductor",
  "conductor_sin_senal",
  "desviacion_ruta",
  "incidencia_sin_responsable",
  "documentacion_bloqueante"
];

const CLASE_SEVERIDAD: Record<SeveridadExcepcionCritica, string> = {
  critica: "border-status-error/35 bg-status-error-soft text-status-error",
  alta: "border-status-warning/45 bg-status-warning-soft text-status-warning",
  media: "border-status-info/35 bg-status-info-soft text-status-info"
};

type EstadoConexionCritica = "datos_en_vivo" | "actualizando" | "reconectando" | "sin_conexion" | "desactualizado";

function tiempoRelativo(fechaIso: string) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(fechaIso).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = minutos / 60;
  if (horas < 24) return `${horas.toFixed(1)} h`;
  return `${Math.floor(horas / 24)} d`;
}

function fechaAdministrativa(fechaIso: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fechaIso));
}

function fechaAdministrativaOpcional(fechaIso: string | null) {
  return fechaIso ? fechaAdministrativa(fechaIso) : "No definido";
}

function textoSlaRestante(horas: number | null) {
  if (horas == null) return "No definido";
  if (horas <= 0) return `${Math.abs(horas).toFixed(1)} h vencido`;
  return `${horas.toFixed(1)} h`;
}

function TarjetaExcepcion({
  excepcion,
  onAsignar,
  onAccion
}: {
  excepcion: ExcepcionCriticaAdmin;
  onAsignar: (id: string, responsable: string) => Promise<void>;
  onAccion: (id: string, accion: "acuse" | "escalar" | "resolver" | "cerrar") => Promise<void>;
}) {
  const accionFaltante = !excepcion.accionPrincipal?.href || !excepcion.accionEscalamiento?.href;
  const cerrable = excepcion.estado === "resuelta";

  return (
    <article className="rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 font-body text-admin-secundario font-semibold ${CLASE_SEVERIDAD[excepcion.severidad]}`}>
              {excepcion.severidad}
            </span>
            <span className="rounded-full border border-border-default bg-surface-secondary px-2.5 py-1 font-body text-admin-secundario font-semibold text-text-secondary">
              {excepcion.estado}
            </span>
            <span className="font-mono-ruum text-admin-secundario uppercase tracking-wide text-text-tertiary">
              {ETIQUETA_CATEGORIA[excepcion.categoria]}
            </span>
          </div>
          <h2 className="mt-2 font-display text-base font-semibold text-ink">{excepcion.folioOEntidad}</h2>
          <p className="mt-1 font-body text-sm leading-6 text-text-secondary">{excepcion.descripcion}</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="font-mono-ruum text-xs uppercase tracking-wide text-text-tertiary">Transcurrido</p>
          <p className="font-display text-xl font-semibold text-ink">{tiempoRelativo(excepcion.creadoEn)}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border-default pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-body text-admin-secundario uppercase tracking-wide text-text-tertiary">Responsable</dt>
          <dd className="mt-1">
            <select
              value={excepcion.responsable ?? ""}
              onChange={(evento) => void onAsignar(excepcion.id, evento.target.value)}
              className="w-full rounded-lg border border-ink/20 bg-surface-primary px-2.5 py-2 font-body text-sm text-ink"
              aria-label={`Asignar responsable para ${excepcion.folioOEntidad}`}
            >
              <option value="">Asignar responsable</option>
              {RESPONSABLES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </dd>
        </div>
        <div>
          <dt className="font-body text-admin-secundario uppercase tracking-wide text-text-tertiary">SLA restante</dt>
          <dd className={excepcion.slaRestanteHoras != null && excepcion.slaRestanteHoras <= 0 ? "mt-1 font-semibold text-status-error" : "mt-1 text-ink"}>
            {textoSlaRestante(excepcion.slaRestanteHoras)}
          </dd>
          <dd className="mt-1 font-body text-xs text-text-tertiary">{excepcion.porcentajeConsumido ?? 0}% consumido</dd>
        </div>
        <div>
          <dt className="font-body text-admin-secundario uppercase tracking-wide text-text-tertiary">Vence</dt>
          <dd className="mt-1 text-ink">{fechaAdministrativaOpcional(excepcion.venceEn)}</dd>
          <dd className="mt-1 font-body text-xs text-text-tertiary">Actualizado {fechaAdministrativa(excepcion.actualizadoEn)}</dd>
        </div>
      </dl>

      {accionFaltante ? (
        <div className="mt-4">
          <Aviso tono="danger">Esta excepción crítica no tiene acción configurada.</Aviso>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={excepcion.accionPrincipal.href}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-signal px-4 py-2.5 font-body text-sm font-bold text-ink shadow-sm transition-colors hover:bg-signal/90"
          >
            {excepcion.accionPrincipal.etiqueta}
          </Link>
          <Link
            href={excepcion.accionEscalamiento.href}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2.5 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-status-error/40 hover:text-status-error"
          >
            Ver origen
          </Link>
          <button
            type="button"
            onClick={() => void onAccion(excepcion.id, "acuse")}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2.5 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-status-info/40 hover:text-status-info"
          >
            Acusar
          </button>
          <button
            type="button"
            onClick={() => void onAccion(excepcion.id, "escalar")}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-status-error/30 bg-status-error-soft px-4 py-2.5 font-body text-sm font-semibold text-status-error transition-colors hover:border-status-error/60"
          >
            Escalar
          </button>
          <button
            type="button"
            onClick={() => void onAccion(excepcion.id, "resolver")}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-status-success/30 bg-status-success-soft px-4 py-2.5 font-body text-sm font-semibold text-status-success transition-colors hover:border-status-success/60"
          >
            Resolver
          </button>
          <button
            type="button"
            disabled={!cerrable}
            onClick={() => void onAccion(excepcion.id, "cerrar")}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2.5 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      )}
    </article>
  );
}

export default function PaginaExcepcionesCriticas() {
  const [excepciones, setExcepciones] = useState<ExcepcionCriticaAdmin[]>([]);
  const [categoria, setCategoria] = useState<CategoriaExcepcionCritica | "todas">("todas");
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: "info" | "danger"; texto: string } | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionCritica>("actualizando");
  const [ultimaRespuestaExitosa, setUltimaRespuestaExitosa] = useState<Date | null>(null);
  const [seccionesDesactualizadas, setSeccionesDesactualizadas] = useState<string[]>([]);
  const [actualizandoManual, setActualizandoManual] = useState(false);

  const cargar = useCallback(async (esRefresco = false) => {
    if (!esRefresco) setCargando(true);
    if (esRefresco) {
      setActualizandoManual(true);
      setEstadoConexion(ultimaRespuestaExitosa ? "reconectando" : "actualizando");
    }
    setAviso(null);
    if (!tieneSupabaseConfigurado()) {
      if (!ultimaRespuestaExitosa) setExcepciones([]);
      setEstadoConexion(ultimaRespuestaExitosa ? "desactualizado" : "sin_conexion");
      setSeccionesDesactualizadas(["alertas SLA reales", "historial operacional", "notificaciones"]);
      setAviso({ tono: "danger", texto: "Supabase no está configurado. Alertas y SLA no muestra excepciones demo." });
      setCargando(false);
      setActualizandoManual(false);
      return;
    }
    try {
      const cliente = crearClienteNavegador();
      setExcepciones(await listarExcepcionesCriticasAdmin(cliente));
      setEstadoConexion("datos_en_vivo");
      setUltimaRespuestaExitosa(new Date());
      setSeccionesDesactualizadas([]);
    } catch (error) {
      const teniaRespuesta = Boolean(ultimaRespuestaExitosa);
      if (!teniaRespuesta) setExcepciones([]);
      setEstadoConexion(teniaRespuesta ? "desactualizado" : "sin_conexion");
      setSeccionesDesactualizadas(["emergencias", "SLA", "asignación", "incidencias"]);
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudieron cargar excepciones críticas reales." });
    } finally {
      setCargando(false);
      setActualizandoManual(false);
    }
  }, [setCargando, setActualizandoManual, setEstadoConexion, setAviso, setExcepciones, setSeccionesDesactualizadas, setUltimaRespuestaExitosa, ultimaRespuestaExitosa]);

  useEffect(() => {
    const categoriaParametro = new URLSearchParams(window.location.search).get("categoria");
    if (esCategoriaExcepcion(categoriaParametro) && categoriaParametro !== "emergencia") {
      setCategoria(categoriaParametro);
    }
    void cargar();
  }, [cargar, setCategoria]);

  async function asignarResponsable(id: string, responsable: string) {
    if (!responsable) return;
    try {
      await actualizarAlertaSlaAdmin(crearClienteNavegador(), id, "asignar", { responsable });
      setAviso({ tono: "info", texto: `Responsable asignado: ${responsable}.` });
      await cargar(true);
    } catch (error) {
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo asignar responsable." });
    }
  }

  async function ejecutarAccion(id: string, accion: "acuse" | "escalar" | "resolver" | "cerrar") {
    try {
      await actualizarAlertaSlaAdmin(crearClienteNavegador(), id, accion, { comentario: `Acción ${accion} desde bandeja Alertas y SLA` });
      setAviso({ tono: "info", texto: `Alerta actualizada: ${accion}.` });
      await cargar(true);
    } catch (error) {
      setAviso({ tono: "danger", texto: error instanceof Error ? error.message : "No se pudo actualizar la alerta." });
    }
  }

  const emergencias = excepciones.filter((item) => item.categoria === "emergencia");
  const operativas = excepciones.filter((item) => item.categoria !== "emergencia");
  const visibles = categoria === "todas"
    ? operativas
    : operativas.filter((item) => item.categoria === categoria);
  const sinAccion = excepciones.filter((item) => !item.accionPrincipal?.href || !item.accionEscalamiento?.href).length;

  const conteos = useMemo(() => {
    const mapa = new Map<CategoriaExcepcionCritica, number>();
    for (const item of excepciones) mapa.set(item.categoria, (mapa.get(item.categoria) ?? 0) + 1);
    return mapa;
  }, [excepciones]);

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Operación crítica"
        titulo="Excepciones críticas"
        descripcion="Bandeja única para emergencias, SLA, asignación, señal, ruta, incidencias y documentación bloqueante."
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaRespuestaExitosa}
        tipoDatos="mixto"
        seccionesDesactualizadas={seccionesDesactualizadas}
        contadorResultados={excepciones.length}
        accion={<Button onClick={() => void cargar(true)} icon="none">{actualizandoManual ? "Reconectando" : "Actualizar"}</Button>}
      />

      {aviso && (
        <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
        </div>
      )}

      {sinAccion > 0 && (
        <div className="mt-4">
          <Aviso tono="danger">{sinAccion} excepciones críticas no tienen acción configurada.</Aviso>
        </div>
      )}

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-body text-xs uppercase tracking-wide text-status-error">Emergencias</p>
            <p className="mt-1 font-body text-sm text-text-secondary">Canal separado de avisos informativos y operativos.</p>
          </div>
          <span className="rounded-full border border-status-error/30 bg-status-error-soft px-3 py-1 font-body text-sm font-semibold text-status-error">
            {emergencias.length} activas
          </span>
        </div>
        {cargando ? (
          <AdminPanel>
            <p className="font-body text-sm text-text-tertiary">Cargando excepciones...</p>
          </AdminPanel>
        ) : emergencias.length === 0 ? (
          <AdminPanel>
            <p className="font-body text-sm text-text-tertiary">Sin emergencias activas.</p>
          </AdminPanel>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {emergencias.map((excepcion) => (
              <TarjetaExcepcion
                key={excepcion.id}
                excepcion={excepcion}
                onAsignar={asignarResponsable}
                onAccion={ejecutarAccion}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCategoria("todas")}
            className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold ${categoria === "todas" ? "border-signal bg-signal text-ink" : "border-border-default bg-surface-primary text-text-secondary"}`}
          >
            Todas ({operativas.length})
          </button>
          {ORDEN_CATEGORIAS.filter((item) => item !== "emergencia").map((item) => (
            <button
              key={item}
              onClick={() => setCategoria(item)}
              className={`rounded-full border px-3 py-1.5 font-body text-sm font-semibold ${categoria === item ? "border-signal bg-signal text-ink" : "border-border-default bg-surface-primary text-text-secondary"}`}
            >
              {ETIQUETA_CATEGORIA[item]} ({conteos.get(item) ?? 0})
            </button>
          ))}
        </div>

        {cargando ? (
          <AdminPanel>
            <p className="font-body text-sm text-text-tertiary">Cargando excepciones...</p>
          </AdminPanel>
        ) : visibles.length === 0 ? (
          <AdminPanel>
            <p className="font-body text-sm text-text-tertiary">No hay excepciones operativas para este filtro.</p>
          </AdminPanel>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {visibles.map((excepcion) => (
              <TarjetaExcepcion
                key={excepcion.id}
                excepcion={excepcion}
                onAsignar={asignarResponsable}
                onAccion={ejecutarAccion}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function esCategoriaExcepcion(valor: string | null): valor is CategoriaExcepcionCritica {
  return valor === "emergencia" ||
    valor === "sla_vencido" ||
    valor === "sla_en_riesgo" ||
    valor === "traslado_sin_conductor" ||
    valor === "conductor_sin_senal" ||
    valor === "desviacion_ruta" ||
    valor === "incidencia_sin_responsable" ||
    valor === "documentacion_bloqueante";
}
