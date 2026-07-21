"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { listarIncidenciasAdmin } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { AdminFiltroActivo, AdminPageHeader, AdminPanel, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminButton, AdminEmptyState, AdminErrorState, AdminLoadingState } from "../admin-components";

type EstatusIncidencia = "Nueva" | "En revisión" | "Requiere información" | "En seguimiento" | "Resuelta" | "Cerrada" | "Escalada";
type Incidencia = Database["public"]["Tables"]["incidencias"]["Row"];
type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "demo";

const TIPOS = [
  "vehiculo_no_enciende",
  "contacto_no_localizado",
  "documentacion_incompleta",
  "dano_previo_relevante"
];

const ESTILO: Record<EstatusIncidencia, string> = {
  Nueva: "border-status-error/25 bg-status-error-soft text-status-error",
  "En revisión": "border-status-info/30 bg-status-info-soft text-status-info",
  "Requiere información": "border-status-warning/40 bg-status-warning-soft text-status-warning",
  "En seguimiento": "border-signal/30 bg-signal-soft text-ink",
  Resuelta: "border-status-success/30 bg-status-success-soft text-status-success",
  Cerrada: "border-ink/15 bg-ink/[0.04] text-text-secondary",
  Escalada: "border-status-error/25 bg-status-error-soft text-status-error"
};

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

const ACCIONES = [
  "Asignar responsable",
  "Agregar notas",
  "Solicitar evidencia adicional",
  "Cambiar estatus",
  "Asociar documentos",
  "Registrar resolución",
  "Notificar al usuario",
  "Notificar al conductor"
];

const FILTRO_ABIERTAS = "Abiertas accionables";

function Badge({ estatus }: { estatus: EstatusIncidencia }) {
  return <span className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold ${ESTILO[estatus]}`}>{estatus}</span>;
}

function etiquetaFiltroTipo(tipo: string) {
  if (tipo === "Todos") return "Todos";
  if (tipo === FILTRO_ABIERTAS) return "Abiertas accionables";
  return tipo.replaceAll("_", " ");
}

export default function PaginaIncidenciasAdmin() {
  const [tipo, setTipo] = useState("Todos");
  const [filtroDesdeUrl, setFiltroDesdeUrl] = useState(false);
  const [incidencias, setIncidencias] = useState<Incidencia[]>(INCIDENCIAS_DEMO);
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("filtro") === "abiertas") {
      setTipo(FILTRO_ABIERTAS);
      setFiltroDesdeUrl(true);
    }
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

  const opcionesFiltro = useMemo(
    () => ["Todos", FILTRO_ABIERTAS, ...TIPOS, ...Array.from(new Set(incidencias.map((incidencia) => incidencia.tipo)))],
    [incidencias]
  );

  const visibles = tipo === "Todos"
    ? incidencias
    : tipo === FILTRO_ABIERTAS
      ? incidencias.filter((incidencia) => !incidencia.resuelta)
      : incidencias.filter((incidencia) => incidencia.tipo === tipo);

  function aplicarFiltro(siguiente: string) {
    setTipo(siguiente);
    if (siguiente === "Todos") {
      setFiltroDesdeUrl(false);
      limpiarParamsFiltroUrl();
    } else {
      setFiltroDesdeUrl(false);
    }
  }

  function limpiarFiltro() {
    setTipo("Todos");
    setFiltroDesdeUrl(false);
    limpiarParamsFiltroUrl();
  }

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Casos y riesgos"
        titulo="Incidencias"
        descripcion="Seguimiento operativo de reportes, evidencia, responsables internos y resolución."
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaActualizacion}
        tipoDatos="administrativos"
        contadorResultados={visibles.length}
        accion={(
          <AdminButton variant="secondary" loading={actualizandoManual} onClick={() => void cargar(true)}>
            Actualizar
          </AdminButton>
        )}
      />

      <div className="mt-4">
        <Aviso tono={esDemo ? "info" : "atencion"}>
          {esDemo ? "Vista con datos de ejemplo para operación administrativa." : "Incidencias reales de la operación."}
        </Aviso>
      </div>

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

      {(filtroDesdeUrl || tipo !== "Todos") && (
        <AdminFiltroActivo etiqueta={etiquetaFiltroTipo(tipo)} onLimpiar={limpiarFiltro} />
      )}

      <section className="mt-6">
        <AdminPanel className="p-5">
          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipos de incidencia</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtros de incidencias">
            {opcionesFiltro.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => aplicarFiltro(item)}
                aria-pressed={tipo === item}
                className={[
                  "rounded-full border px-3 py-1.5 font-body text-admin-boton font-semibold",
                  tipo === item ? "border-signal bg-signal-soft text-ink" : "border-ink/10 text-text-secondary hover:border-ink/25"
                ].join(" ")}
              >
                {etiquetaFiltroTipo(item)}
              </button>
            ))}
          </div>
        </AdminPanel>
      </section>

      <section className="mt-6 grid gap-4">
        {cargando && <AdminLoadingState label="Cargando incidencias" />}
        {!cargando && visibles.length === 0 && (
          <AdminEmptyState
            title="Sin incidencias"
            description="No hay incidencias para este filtro."
            action={(
              <AdminButton variant="secondary" onClick={limpiarFiltro}>
                Ver todas
              </AdminButton>
            )}
          />
        )}
        {!cargando && visibles.map((incidencia) => (
          <AdminPanel key={incidencia.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono-ruum text-xs uppercase tracking-wide text-text-tertiary">ID interno {incidencia.id.slice(0, 12).toUpperCase()}</p>
                <h2 className="mt-1 font-display text-xl font-semibold">{incidencia.tipo.replaceAll("_", " ")}</h2>
                <p className="mt-2 font-body text-sm text-text-secondary">{incidencia.descripcion}</p>
              </div>
              <Badge estatus={incidencia.resuelta ? "Resuelta" : "En revisión"} />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Traslado relacionado</dt>
                <dd className="mt-1 font-body text-sm font-medium">
                  <Link href={`/viajes/${incidencia.traslado_id}`} className="text-status-info">
                    {incidencia.traslado_id.slice(0, 8).toUpperCase()}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Reportada por</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.reportada_por}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Momento</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.momento.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Fecha y hora</dt>
                <dd className="mt-1 font-body text-sm font-medium">{new Date(incidencia.creada_en).toLocaleString("es-MX")}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Estado</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.resuelta ? "Resuelta" : "Abierta"}</dd>
              </div>
              <div>
                <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Resolución</dt>
                <dd className="mt-1 font-body text-sm font-medium">{incidencia.resuelta_en ? new Date(incidencia.resuelta_en).toLocaleString("es-MX") : "Pendiente"}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {ACCIONES.map((accion) => (
                <AdminButton key={accion} variant="quiet" type="button">
                  {accion}
                </AdminButton>
              ))}
            </div>
          </AdminPanel>
        ))}
      </section>
    </main>
  );
}
