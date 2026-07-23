"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Aviso } from "@ruum/ui";
import { AdminDataTable, type AdminDataTableColumn } from "../AdminDataTable";
import { AdminFiltroActivo, AdminPageHeader, limpiarParamsFiltroUrl } from "../admin-ui";
import { AdminButton, AdminErrorState } from "../admin-components";
import {
  listarSolicitudesConductorAdminPaginadas,
  type SolicitudConductorBandejaAdmin
} from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type FiltroBandeja = "todas" | "nuevas" | "en_revision" | "documentos_rechazados" | "pendientes_correccion" | "aprobadas" | "rechazadas";
type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "sin_conexion" | "desactualizado";
const TAMANO_PAGINA = 25;

const FILTROS: { valor: FiltroBandeja; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "nuevas", etiqueta: "Nuevas" },
  { valor: "en_revision", etiqueta: "En revisión" },
  { valor: "documentos_rechazados", etiqueta: "Documentos rechazados" },
  { valor: "pendientes_correccion", etiqueta: "Pendientes de corrección" },
  { valor: "aprobadas", etiqueta: "Aprobadas" },
  { valor: "rechazadas", etiqueta: "Rechazadas" }
];

const ETIQUETA_ESTADO: Record<SolicitudConductorBandejaAdmin["solicitud"]["estado"], string> = {
  borrador: "Borrador",
  correo_pendiente: "Correo pendiente",
  datos_incompletos: "Datos incompletos",
  documentos_pendientes: "Documentos pendientes",
  listo_para_enviar: "Lista para enviar",
  en_revision: "En revisión",
  requiere_correccion: "Requiere corrección",
  aprobado: "Aprobada",
  rechazado: "Rechazada",
  suspendido: "Suspendida"
};

function esNueva(fila: SolicitudConductorBandejaAdmin) {
  return fila.solicitud.estado === "en_revision"
    && (!fila.ultimaDecision || ["registro_inicial", "cambio_estado"].includes(fila.ultimaDecision.decision));
}

function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin enviar";
}

export default function PaginaConductoresAdmin() {
  const [solicitudes, setSolicitudes] = useState<SolicitudConductorBandejaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizandoManual, setActualizandoManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroBandeja>("todas");
  const [filtroDesdeUrl, setFiltroDesdeUrl] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [pagina, setPagina] = useState(1);
  const [totalResultados, setTotalResultados] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);

  useEffect(() => {
    const filtroUrl = new URLSearchParams(window.location.search).get("filtro");
    if (FILTROS.some(({ valor }) => valor === filtroUrl)) {
      setFiltro(filtroUrl as FiltroBandeja);
      setFiltroDesdeUrl(true);
    }
  }, []);

  const cargar = useCallback(async (manual = false, paginaSolicitada = 1) => {
    if (manual) setActualizandoManual(true);
    else setCargando(true);

    if (!tieneSupabaseConfigurado()) {
      setSolicitudes([]);
      setError("Supabase no configurado.");
      setEstadoConexion("sin_conexion");
      setUltimaActualizacion(new Date());
      setCargando(false);
      setActualizandoManual(false);
      return;
    }

    try {
      setError(null);
      const resultado = await listarSolicitudesConductorAdminPaginadas(
        crearClienteNavegador(),
        paginaSolicitada,
        TAMANO_PAGINA,
        filtro,
        busqueda
      );
      setSolicitudes(resultado.data);
      setPagina(resultado.paginacion.pagina);
      setTotalResultados(resultado.paginacion.total);
      setTotalPaginas(resultado.paginacion.total_paginas);
      setEstadoConexion("datos_en_vivo");
      setUltimaActualizacion(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar la bandeja de revisión.");
      setEstadoConexion((estadoAnterior) => estadoAnterior === "datos_en_vivo" ? "desactualizado" : "sin_conexion");
    } finally {
      setCargando(false);
      setActualizandoManual(false);
    }
  }, [busqueda, filtro]);

  useEffect(() => {
    const timer = setTimeout(() => { void cargar(false, 1); }, 250);
    return () => clearTimeout(timer);
  }, [busqueda, cargar, filtro]);

  const filas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return solicitudes.filter((fila) => !termino || [
      fila.nombre, fila.telefono, fila.curp, fila.solicitud.id
    ].some((valor) => valor?.toLowerCase().includes(termino)));
  }, [solicitudes, busqueda]);

  const etiquetaFiltro = FILTROS.find((item) => item.valor === filtro)?.etiqueta ?? filtro;

  function aplicarFiltro(valor: FiltroBandeja) {
    setFiltro(valor);
    if (valor === "todas") {
      setFiltroDesdeUrl(false);
      limpiarParamsFiltroUrl();
    } else {
      setFiltroDesdeUrl(false);
    }
  }

  function limpiarFiltro() {
    setFiltro("todas");
    setFiltroDesdeUrl(false);
    limpiarParamsFiltroUrl();
  }

  const columnas = useMemo<AdminDataTableColumn<SolicitudConductorBandejaAdmin>[]>(() => [
    {
      id: "solicitante",
      header: "Solicitante",
      sortValue: (fila) => fila.nombre,
      cell: (fila) => (
        <>
          <p className="font-medium">{fila.nombre}</p>
          <p className="mt-0.5 text-admin-secundario text-text-tertiary">{fila.curp ?? fila.telefono ?? fila.solicitud.id}</p>
        </>
      )
    },
    {
      id: "estado",
      header: "Estado",
      sortValue: (fila) => fila.solicitud.estado,
      cell: (fila) => (
        <>
          <span className="rounded-full border border-ink/15 bg-ink/[0.04] px-2.5 py-1 text-admin-secundario font-medium">
            {ETIQUETA_ESTADO[fila.solicitud.estado]}
          </span>
          {esNueva(fila) && <span className="ml-2 text-admin-secundario font-semibold text-status-info">Nueva</span>}
        </>
      )
    },
    {
      id: "documentos",
      header: "Documentos",
      sortValue: (fila) => fila.documentosRechazados * -100 + fila.documentosVigentes,
      cell: (fila) => (
        <span className={fila.documentosRechazados ? "font-semibold text-status-error" : "text-text-secondary"}>
          {fila.documentosVigentes} vigentes
          {fila.documentosRechazados ? ` · ${fila.documentosRechazados} rechazado(s)` : ""}
        </span>
      )
    },
    {
      id: "consentimientos",
      header: "Consentimientos",
      sortValue: (fila) => fila.consentimientosRegistrados,
      cell: (fila) => (
        <span className={fila.consentimientosRegistrados === 4 ? "text-status-success" : "text-status-warning"}>
          {fila.consentimientosRegistrados}/4
        </span>
      )
    },
    {
      id: "enviada",
      header: "Enviada",
      sortValue: (fila) => fila.solicitud.enviado_en ?? "",
      cell: (fila) => <span className="text-text-secondary">{fecha(fila.solicitud.enviado_en)}</span>
    },
    {
      id: "decision",
      header: "Última decisión",
      sortValue: (fila) => fila.ultimaDecision?.motivo ?? "",
      cell: (fila) => <span className="text-admin-secundario text-text-secondary">{fila.ultimaDecision?.motivo ?? "Sin decisiones administrativas"}</span>
    }
  ], []);

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Gestión"
        titulo="Solicitudes de conductor"
        descripcion="Bandeja basada en expedientes, documentos vigentes, consentimientos y decisiones registradas."
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaActualizacion}
        tipoDatos="administrativos"
        contadorResultados={totalResultados}
        accion={(
          <AdminButton
            variant="secondary"
            loading={actualizandoManual}
            onClick={() => void cargar(true, pagina)}
          >
            Actualizar
          </AdminButton>
        )}
      />

      {avisoAccion && (
        <div className="mt-4">
          <Aviso tono="info">{avisoAccion}</Aviso>
        </div>
      )}
      {error && !cargando && (
        <div className="mt-4">
          <AdminErrorState
            description={error}
            action={(
              <AdminButton variant="secondary" onClick={() => void cargar(true, pagina)}>
                Reintentar
              </AdminButton>
            )}
          />
        </div>
      )}

      {(filtroDesdeUrl || filtro !== "todas") && (
        <AdminFiltroActivo etiqueta={etiquetaFiltro} onLimpiar={limpiarFiltro} />
      )}

      <div className="mt-6 flex flex-wrap gap-2" aria-label="Filtros de solicitudes" role="group">
        {FILTROS.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            onClick={() => aplicarFiltro(valor)}
            aria-pressed={filtro === valor}
            className={`rounded-full border px-3 py-1.5 font-body text-admin-boton font-medium transition ${
              filtro === valor ? "border-status-info bg-status-info text-background-main" : "border-ink/15 bg-surface-primary text-text-secondary hover:border-status-info/40"
            }`}
          >
            {etiqueta}{filtro === valor ? ` · ${totalResultados}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-solicitudes">Buscar solicitudes</label>
        <input
          id="buscar-solicitudes"
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre, CURP, teléfono o folio…"
          className="flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
      </div>

      <AdminDataTable
        caption="Bandeja de solicitudes de conductor"
        rows={filas}
        columns={columnas}
        getRowId={(fila) => fila.solicitud.id}
        loading={cargando}
        emptyMessage="No hay solicitudes para este filtro."
        partialError={null}
        selectedIds={seleccionados}
        onSelectionChange={setSeleccionados}
        rowActions={[{ label: "Revisar", href: (fila) => `/conductores/${fila.solicitud.id}` }]}
        bulkActions={[
          { label: "Revisar selección", onClick: () => setAvisoAccion("La revisión masiva requiere seleccionar una regla de decisión antes de ejecutarse.") },
          { label: "Exportar selección", onClick: () => setAvisoAccion("La exportación se habilitará cuando el backend genere archivos firmados y auditables.") }
        ]}
      />
      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <AdminButton variant="secondary" disabled={pagina <= 1 || actualizandoManual} onClick={() => void cargar(true, pagina - 1)}>
            Anterior
          </AdminButton>
          <span className="font-body text-sm text-text-tertiary">Página {pagina} de {totalPaginas}</span>
          <AdminButton variant="secondary" disabled={pagina >= totalPaginas || actualizandoManual} onClick={() => void cargar(true, pagina + 1)}>
            Siguiente
          </AdminButton>
        </div>
      )}
    </main>
  );
}
