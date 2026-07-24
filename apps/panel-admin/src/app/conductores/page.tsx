"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const ETIQUETA_DOCUMENTO: Record<string, string> = {
  licencia_frente: "Licencia frente",
  licencia_reverso: "Licencia reverso",
  identificacion_oficial: "Identificación oficial",
  documento_operativo: "Documento operativo"
};

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

const CLASE_ESTADO: Record<SolicitudConductorBandejaAdmin["solicitud"]["estado"], string> = {
  borrador: "border-ink/15 bg-ink/[0.04] text-text-secondary",
  correo_pendiente: "border-status-warning/35 bg-status-warning-soft text-status-warning",
  datos_incompletos: "border-status-warning/35 bg-status-warning-soft text-status-warning",
  documentos_pendientes: "border-status-warning/35 bg-status-warning-soft text-status-warning",
  listo_para_enviar: "border-status-info/30 bg-status-info-soft text-status-info",
  en_revision: "border-status-warning/35 bg-status-warning-soft text-status-warning",
  requiere_correccion: "border-status-error/30 bg-status-error-soft text-status-error",
  aprobado: "border-status-success/30 bg-status-success-soft text-status-success",
  rechazado: "border-status-error/30 bg-status-error-soft text-status-error",
  suspendido: "border-ink/30 bg-ink/10 text-text-tertiary"
};

const CLASE_DOCUMENTO: Record<string, string> = {
  aprobado: "text-status-success",
  en_revision: "text-status-warning",
  rechazado: "text-status-error",
  vencido: "text-status-error"
};

function esNueva(fila: SolicitudConductorBandejaAdmin) {
  return fila.solicitud.estado === "en_revision"
    && (!fila.ultimaDecision || ["registro_inicial", "cambio_estado"].includes(fila.ultimaDecision.decision));
}

function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin enviar";
}

function valorCsv(valor: string | number | null | undefined) {
  return `"${String(valor ?? "").replaceAll("\"", "\"\"")}"`;
}

function descargarArchivo(nombre: string, tipo: string, contenido: string) {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportarSolicitudesCsv(filas: SolicitudConductorBandejaAdmin[]) {
  const encabezado = ["folio", "nombre", "curp", "telefono", "estado", "documentos_vigentes", "documentos_rechazados", "consentimientos", "enviada", "ultima_decision"];
  const datos = filas.map((fila) => [
    fila.solicitud.id,
    fila.nombre,
    fila.curp ?? "",
    fila.telefono ?? "",
    ETIQUETA_ESTADO[fila.solicitud.estado],
    fila.documentosVigentes,
    fila.documentosRechazados,
    `${fila.consentimientosRegistrados}/4`,
    fecha(fila.solicitud.enviado_en),
    fila.ultimaDecision?.motivo ?? "Sin registros"
  ]);
  return [encabezado, ...datos].map((fila) => fila.map(valorCsv).join(",")).join("\n");
}

function DocumentosResumen({ fila }: { fila: SolicitudConductorBandejaAdmin }) {
  return (
    <details className="relative inline-block">
      <summary className="list-none cursor-pointer rounded-md px-1 py-0.5 hover:bg-surface-secondary">
        <span className="text-text-secondary">{fila.documentosVigentes} vigentes</span>
        {fila.documentosRechazados > 0 && <span className="font-semibold text-status-error"> · {fila.documentosRechazados} rechazado{fila.documentosRechazados === 1 ? "" : "s"}</span>}
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-72 rounded-lg border border-border-default bg-surface-primary p-3 shadow-[var(--ruum-shadow-3)]">
        <p className="font-body text-admin-secundario font-semibold uppercase tracking-[0.12em] text-text-tertiary">Documentos</p>
        <div className="mt-2 space-y-2">
          {(fila.documentos ?? []).length === 0 ? (
            <p className="font-body text-sm text-text-tertiary">Sin detalle documental en la bandeja.</p>
          ) : fila.documentos.map((documento) => (
            <div key={documento.id} className="flex items-start justify-between gap-3 font-body text-sm">
              <span className="min-w-0 truncate text-text-secondary">{ETIQUETA_DOCUMENTO[documento.tipo] ?? documento.tipo}</span>
              <span className={`shrink-0 font-semibold ${CLASE_DOCUMENTO[documento.estado] ?? "text-text-tertiary"}`}>
                {documento.estado === "aprobado" ? "Aprobado" : documento.estado === "rechazado" ? "Corrección" : documento.estado === "en_revision" ? "En revisión" : documento.estado}
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function PaginaConductoresAdmin() {
  const router = useRouter();
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

  function revisarSeleccion(filasSeleccionadas: SolicitudConductorBandejaAdmin[]) {
    const primera = filasSeleccionadas[0];
    if (!primera) return;
    if (filasSeleccionadas.length > 1) {
      window.sessionStorage.setItem("ruum-conductores-revision-lote", JSON.stringify(filasSeleccionadas.map((fila) => fila.solicitud.id)));
      setAvisoAccion(`Lote de revisión listo: se abrirá el primer pasaporte y quedan ${filasSeleccionadas.length - 1} en la tanda.`);
    }
    router.push(`/conductores/${primera.solicitud.id}`);
  }

  function exportarSeleccion(filasSeleccionadas: SolicitudConductorBandejaAdmin[]) {
    descargarArchivo("ruum-conductores-seleccion.csv", "text/csv", exportarSolicitudesCsv(filasSeleccionadas));
    setAvisoAccion(`${filasSeleccionadas.length.toLocaleString("es-MX")} solicitud${filasSeleccionadas.length === 1 ? "" : "es"} exportada${filasSeleccionadas.length === 1 ? "" : "s"} en CSV.`);
  }

  const columnas = useMemo<AdminDataTableColumn<SolicitudConductorBandejaAdmin>[]>(() => [
    {
      id: "solicitante",
      header: "Solicitante",
      sortValue: (fila) => fila.nombre,
      cell: (fila) => (
        <>
          <p className="font-medium">{fila.nombre}</p>
          <p className="mt-0.5 truncate text-admin-secundario text-text-tertiary">{fila.curp ?? fila.telefono ?? fila.solicitud.id}</p>
        </>
      )
    },
    {
      id: "estado",
      header: "Estado",
      sortValue: (fila) => fila.solicitud.estado,
      cell: (fila) => (
        <span className="inline-flex items-center gap-2">
          {esNueva(fila) && <span className="size-2 rounded-full bg-status-info" aria-label="Solicitud nueva" title="Nueva" />}
          <span className={`rounded-full border px-2.5 py-1 text-admin-secundario font-semibold ${CLASE_ESTADO[fila.solicitud.estado]}`}>
            {ETIQUETA_ESTADO[fila.solicitud.estado]}
          </span>
        </span>
      )
    },
    {
      id: "documentos",
      header: "Documentos",
      sortValue: (fila) => fila.documentosRechazados * -100 + fila.documentosVigentes,
      cell: (fila) => <DocumentosResumen fila={fila} />
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
      cell: (fila) => {
        const texto = fila.ultimaDecision?.motivo;
        return texto ? (
          <span className="block max-w-64 truncate text-admin-secundario text-text-secondary" title={texto}>{texto}</span>
        ) : (
          <span className="rounded-full border border-ink/10 bg-ink/[0.03] px-2.5 py-1 text-admin-secundario font-medium text-text-tertiary">Sin registros</span>
        );
      }
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

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-primary px-3 py-3 shadow-[var(--ruum-shadow-1)]">
        <label className="font-body text-admin-secundario font-semibold text-text-secondary" htmlFor="filtro-estado">Estado</label>
        <select
          id="filtro-estado"
          value={filtro}
          onChange={(event) => aplicarFiltro(event.target.value as FiltroBandeja)}
          className="min-h-10 rounded-lg border border-ink/20 bg-surface-primary px-3 py-2 font-body text-sm text-ink focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        >
          {FILTROS.map(({ valor, etiqueta }) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </select>
        <label className="sr-only" htmlFor="buscar-solicitudes">Buscar solicitudes</label>
        <input
          id="buscar-solicitudes"
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre, CURP, teléfono o folio…"
          className="min-h-10 min-w-56 flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
        <AdminButton
          variant="secondary"
          loading={actualizandoManual}
          onClick={() => void cargar(true, pagina)}
        >
          Actualizar
        </AdminButton>
        <AdminButton
          variant="secondary"
          disabled={filas.length === 0}
          onClick={() => {
            descargarArchivo("ruum-conductores-vista.csv", "text/csv", exportarSolicitudesCsv(filas));
            setAvisoAccion(`${filas.length.toLocaleString("es-MX")} resultado${filas.length === 1 ? "" : "s"} exportado${filas.length === 1 ? "" : "s"} en CSV.`);
          }}
        >
          Exportar vista
        </AdminButton>
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
          { label: "Revisar selección", onClick: revisarSeleccion },
          { label: "Exportar selección", onClick: exportarSeleccion }
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
