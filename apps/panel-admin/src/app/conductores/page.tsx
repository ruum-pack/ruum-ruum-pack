"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import {
  listarSolicitudesConductorAdmin,
  type SolicitudConductorBandejaAdmin
} from "@ruum/api/services";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

type FiltroBandeja = "todas" | "nuevas" | "en_revision" | "documentos_rechazados" | "pendientes_correccion" | "aprobadas" | "rechazadas";

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

function coincideFiltro(fila: SolicitudConductorBandejaAdmin, filtro: FiltroBandeja) {
  if (filtro === "todas") return true;
  if (filtro === "nuevas") return esNueva(fila);
  if (filtro === "en_revision") return fila.solicitud.estado === "en_revision";
  if (filtro === "documentos_rechazados") return fila.documentosRechazados > 0;
  if (filtro === "pendientes_correccion") return fila.solicitud.estado === "requiere_correccion";
  if (filtro === "aprobadas") return fila.solicitud.estado === "aprobado";
  return fila.solicitud.estado === "rechazado";
}

function fecha(valor: string | null) {
  return valor ? new Date(valor).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "Sin enviar";
}

export default function PaginaConductoresAdmin() {
  const [solicitudes, setSolicitudes] = useState<SolicitudConductorBandejaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [esDemo, setEsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroBandeja>("todas");

  useEffect(() => {
    const filtroUrl = new URLSearchParams(window.location.search).get("filtro");
    if (FILTROS.some(({ valor }) => valor === filtroUrl)) setFiltro(filtroUrl as FiltroBandeja);
  }, []);

  const cargar = useCallback(async () => {
    if (!tieneSupabaseConfigurado()) {
      setSolicitudes([]);
      setEsDemo(true);
      setCargando(false);
      return;
    }
    try {
      setError(null);
      setSolicitudes(await listarSolicitudesConductorAdmin(crearClienteNavegador()));
      setEsDemo(false);
    } catch (err) {
      if (puedeUsarDatosDemo()) {
        setSolicitudes([]);
        setEsDemo(true);
      } else {
        setError(err instanceof Error ? err.message : "No pudimos cargar la bandeja de revisión.");
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void cargar(); }, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  const conteos = useMemo(() => Object.fromEntries(
    FILTROS.map(({ valor }) => [valor, solicitudes.filter((fila) => coincideFiltro(fila, valor)).length])
  ) as Record<FiltroBandeja, number>, [solicitudes]);

  const filas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return solicitudes.filter((fila) => coincideFiltro(fila, filtro)).filter((fila) => !termino || [
      fila.nombre, fila.telefono, fila.curp, fila.solicitud.id
    ].some((valor) => valor?.toLowerCase().includes(termino)));
  }, [solicitudes, filtro, busqueda]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8 sm:py-10">
      <div>
        <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Torre de Control</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Solicitudes de conductor</h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-text-secondary">
          Bandeja basada en expedientes, documentos vigentes, consentimientos y decisiones registradas.
        </p>
      </div>

      {esDemo && <div className="mt-4"><Aviso tono="info">Configura Supabase para consultar solicitudes reales.</Aviso></div>}
      {error && <div className="mt-4"><Aviso tono="danger">{error}</Aviso></div>}

      <div className="mt-6 flex flex-wrap gap-2" aria-label="Filtros de solicitudes">
        {FILTROS.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            aria-pressed={filtro === valor}
            className={`rounded-full border px-3 py-1.5 font-body text-admin-boton font-medium transition ${
              filtro === valor ? "border-status-info bg-status-info text-background-main" : "border-ink/15 bg-surface-primary text-text-secondary hover:border-status-info/40"
            }`}
          >
            {etiqueta} · {conteos[valor] ?? 0}
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

      <div className="mt-3 overflow-x-auto rounded-card border border-ink/10 bg-surface-primary">
        <table className="w-full min-w-[920px] font-body text-sm">
          <caption className="sr-only">Bandeja de solicitudes de conductor</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Documentos</th>
              <th className="px-4 py-3">Consentimientos</th>
              <th className="px-4 py-3">Enviada</th>
              <th className="px-4 py-3">Última decisión</th>
              <th className="px-4 py-3"><span className="sr-only">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">Cargando…</td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">No hay solicitudes para este filtro.</td></tr>
            ) : filas.map((fila) => (
              <tr key={fila.solicitud.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{fila.nombre}</p>
                  <p className="mt-0.5 text-admin-secundario text-text-tertiary">{fila.curp ?? fila.telefono ?? fila.solicitud.id}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-ink/15 bg-ink/[0.04] px-2.5 py-1 text-admin-secundario font-medium">
                    {ETIQUETA_ESTADO[fila.solicitud.estado]}
                  </span>
                  {esNueva(fila) && <span className="ml-2 text-admin-secundario font-semibold text-status-info">Nueva</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={fila.documentosRechazados ? "font-semibold text-status-error" : "text-text-secondary"}>
                    {fila.documentosVigentes} vigentes
                    {fila.documentosRechazados ? ` · ${fila.documentosRechazados} rechazado(s)` : ""}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={fila.consentimientosRegistrados === 4 ? "text-status-success" : "text-status-warning"}>
                    {fila.consentimientosRegistrados}/4
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{fecha(fila.solicitud.enviado_en)}</td>
                <td className="max-w-[220px] px-4 py-3 text-admin-secundario text-text-secondary">
                  {fila.ultimaDecision?.motivo ?? "Sin decisiones administrativas"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/conductores/${fila.solicitud.id}`} className="font-medium text-status-info hover:underline">
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
