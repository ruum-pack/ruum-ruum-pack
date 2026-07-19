"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Aviso, EstadoBadge } from "@ruum/ui";
import { AdminPageHeader, AdminPanel } from "../admin-ui";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador, puedeUsarDatosDemo, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { listarCargasTrasladosMasivosAdmin, listarViajesAdmin, type TrazabilidadMasivaTraslado } from "@ruum/api/services";
import { VIAJES_DEMO } from "../../lib/datos-demo";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type FiltroKpi = "activos" | "inician_60" | "sin_asignacion" | "incidencia" | "finalizados_hoy";
type AccionOperativa = "asignar_conductor" | "registrar_incidencia";
type EstadoConexionVista = "datos_en_vivo" | "actualizando" | "reconectando" | "sin_conexion" | "desactualizado" | "demo";

// PRD §17.4 — pestañas. "Todos" + un subconjunto representativo del camino
// feliz y sus ramas — no los 33 estados técnicos, que es justo la traducción
// que el PRD pide ("Programados" agrupa todo lo previo a en curso).
const PESTANAS: { id: string; etiqueta: string; filtro: EstadoTraslado | "todos" }[] = [
  { id: "todos", etiqueta: "Todos", filtro: "todos" },
  { id: "pendientes", etiqueta: "Pendientes", filtro: "pendiente_de_conductor" },
  { id: "en_curso", etiqueta: "En curso", filtro: "traslado_en_curso" },
  { id: "finalizados", etiqueta: "Finalizados", filtro: "servicio_cerrado" },
  { id: "cancelados", etiqueta: "Cancelados", filtro: "servicio_cancelado" }
];

const ESTADOS_TERMINALES: EstadoTraslado[] = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];

const ETIQUETA_FILTRO_KPI: Record<FiltroKpi, string> = {
  activos: "Traslados activos",
  inician_60: "Inician en 60 minutos",
  sin_asignacion: "Sin asignación",
  incidencia: "Con incidencia",
  finalizados_hoy: "Finalizados hoy"
};

const ETIQUETA_ACCION_OPERATIVA: Record<AccionOperativa, string> = {
  asignar_conductor: "Asignar conductor",
  registrar_incidencia: "Registrar incidencia"
};

export default function PaginaViajesAdmin() {
  const [pestana, setPestana] = useState(PESTANAS[0]!.id);
  const [traslados, setTraslados] = useState<PasaporteRow[]>([]);
  const [trazabilidadPorTraslado, setTrazabilidadPorTraslado] = useState<Map<string, TrazabilidadMasivaTraslado>>(new Map());
  const [esDemo, setEsDemo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroKpi, setFiltroKpi] = useState<FiltroKpi | null>(null);
  const [accionOperativa, setAccionOperativa] = useState<AccionOperativa | null>(null);
  const [estadoConexion, setEstadoConexion] = useState<EstadoConexionVista>("actualizando");
  const [ultimaRespuestaExitosa, setUltimaRespuestaExitosa] = useState<Date | null>(null);
  const [seccionesDesactualizadas, setSeccionesDesactualizadas] = useState<string[]>([]);
  const [actualizandoManual, setActualizandoManual] = useState(false);

  const filtroActual = PESTANAS.find((p) => p.id === pestana)!.filtro;

  useEffect(() => {
    const parametro = new URLSearchParams(window.location.search).get("filtro");
    if (esFiltroKpi(parametro)) {
      setFiltroKpi(parametro);
      setPestana("todos");
    }
    const accion = new URLSearchParams(window.location.search).get("accion");
    if (esAccionOperativa(accion)) setAccionOperativa(accion);
  }, []);

  async function cargar(esRefresco = false) {
      if (!esRefresco) setCargando(true);
      if (esRefresco) {
        setActualizandoManual(true);
        setEstadoConexion(ultimaRespuestaExitosa ? "reconectando" : "actualizando");
      }
      if (!tieneSupabaseConfigurado()) {
        const lista = filtroActual === "todos" ? VIAJES_DEMO : VIAJES_DEMO.filter((v) => v.estado === filtroActual);
        setTraslados(lista);
        setEsDemo(true);
        setEstadoConexion("demo");
        setUltimaRespuestaExitosa(new Date());
        setSeccionesDesactualizadas([]);
        setCargando(false);
        setActualizandoManual(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const [lista, masivos] = await Promise.all([
          listarViajesAdmin(cliente, filtroActual),
          listarCargasTrasladosMasivosAdmin(cliente)
        ]);
        const cargasPorId = new Map(masivos.cargas.map((carga) => [carga.id, carga]));
        setTrazabilidadPorTraslado(new Map(
          masivos.filas
            .filter((fila) => fila.traslado_id)
            .flatMap((fila) => {
              const carga = cargasPorId.get(fila.carga_id);
              return carga && fila.traslado_id ? [[fila.traslado_id, { carga, fila } as TrazabilidadMasivaTraslado]] : [];
            })
        ));
        setTraslados(lista);
        setEsDemo(false);
        setEstadoConexion("datos_en_vivo");
        setUltimaRespuestaExitosa(new Date());
        setSeccionesDesactualizadas([]);
      } catch {
        const teniaRespuesta = Boolean(ultimaRespuestaExitosa);
        if (puedeUsarDatosDemo()) {
          const lista = filtroActual === "todos" ? VIAJES_DEMO : VIAJES_DEMO.filter((v) => v.estado === filtroActual);
          setTraslados(lista);
          setTrazabilidadPorTraslado(new Map());
          setEsDemo(true);
          setEstadoConexion(teniaRespuesta ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["traslados administrativos", "trazabilidad de cargas masivas"]);
        } else {
          setTraslados([]);
          setTrazabilidadPorTraslado(new Map());
          setEsDemo(false);
          setEstadoConexion(teniaRespuesta ? "desactualizado" : "sin_conexion");
          setSeccionesDesactualizadas(["traslados administrativos", "trazabilidad de cargas masivas"]);
        }
      } finally {
        setCargando(false);
        setActualizandoManual(false);
      }
  }

  useEffect(() => {
    void cargar();
  }, [filtroActual]);

  const trasladosPorKpi = useMemo(() => {
    if (!filtroKpi) return traslados;
    const ahora = Date.now();
    const en60Min = ahora + 60 * 60 * 1000;
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    return traslados.filter((v) => {
      const extendido = v as PasaporteRow & {
        modalidad_programacion?: string | null;
        fecha_hora_programada?: string | null;
        tiene_incidencia_abierta?: boolean | null;
        incidencias_abiertas?: number | null;
        actualizado_en?: string | null;
      };
      if (filtroKpi === "activos") return v.estado ? !ESTADOS_TERMINALES.includes(v.estado) : false;
      if (filtroKpi === "sin_asignacion") return v.estado === "pendiente_de_conductor";
      if (filtroKpi === "incidencia") return Boolean(extendido.tiene_incidencia_abierta) || Number(extendido.incidencias_abiertas ?? 0) > 0;
      if (filtroKpi === "finalizados_hoy") {
        const fechaCierre = extendido.actualizado_en ? new Date(extendido.actualizado_en).getTime() : 0;
        return v.estado === "servicio_cerrado" && fechaCierre >= inicioHoy.getTime();
      }
      if (filtroKpi === "inician_60") {
        const fechaProgramada = extendido.fecha_hora_programada ? new Date(extendido.fecha_hora_programada).getTime() : 0;
        return extendido.modalidad_programacion === "programado" && fechaProgramada >= ahora && fechaProgramada <= en60Min;
      }
      return true;
    });
  }, [filtroKpi, traslados]);

  const trasladosFiltrados = busqueda.trim()
    ? trasladosPorKpi.filter((v) => {
        const q = busqueda.trim().toLowerCase();
        return (
          (v.traslado_id?.slice(0, 8).toLowerCase().includes(q) ?? false) ||
          `${v.vehiculo_marca ?? ""} ${v.vehiculo_modelo ?? ""}`.toLowerCase().includes(q) ||
          (v.conductor_nombre ?? "").toLowerCase().includes(q)
        );
      })
    : trasladosPorKpi;

  return (
    <main className="admin-page-shell">
      <AdminPageHeader
        etiqueta="Operación"
        titulo={accionOperativa ? ETIQUETA_ACCION_OPERATIVA[accionOperativa] : filtroKpi ? ETIQUETA_FILTRO_KPI[filtroKpi] : "Traslados"}
        descripcion={accionOperativa ? "Selecciona el traslado operativo correspondiente." : filtroKpi ? "Vista filtrada desde indicadores accionables del dashboard." : "Bandeja operativa para revisar folios, conductor asignado, monto autorizado y estado actual."}
        estadoConexion={estadoConexion}
        ultimaActualizacion={ultimaRespuestaExitosa}
        tipoDatos="administrativos"
        seccionesDesactualizadas={seccionesDesactualizadas}
        contadorResultados={trasladosFiltrados.length}
        accion={(
          <button
            type="button"
            onClick={() => void cargar(true)}
            disabled={actualizandoManual}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2 font-body text-admin-boton font-semibold text-text-secondary transition-colors hover:border-signal/50 hover:text-ink disabled:cursor-wait disabled:opacity-70"
          >
            {actualizandoManual ? "Reconectando" : "Actualizar"}
          </button>
        )}
      />

      {esDemo && (
        <div className="mt-4">
          <Aviso tono="info">Estás viendo datos de ejemplo, no traslados reales.</Aviso>
        </div>
      )}

      <div className="mt-6 flex gap-1 border-b border-ink/10">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={[
              "px-4 py-2.5 font-body text-sm font-medium transition-colors",
              pestana === p.id ? "border-b-2 border-signal text-ink" : "text-text-secondary hover:text-ink"
            ].join(" ")}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {filtroKpi && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-info/25 bg-status-info-soft px-4 py-3">
          <p className="font-body text-sm font-semibold text-status-info">
            Filtro activo: {ETIQUETA_FILTRO_KPI[filtroKpi]}
          </p>
          <button
            onClick={() => {
              setFiltroKpi(null);
              setAccionOperativa(null);
            }}
            className="font-body text-sm font-semibold text-status-info hover:underline"
          >
            Ver todos
          </button>
        </div>
      )}

      {accionOperativa && (
        <div className="mt-4 rounded-lg border border-signal/35 bg-signal-soft px-4 py-3">
          <p className="font-body text-sm font-semibold text-ink">{ETIQUETA_ACCION_OPERATIVA[accionOperativa]}</p>
          <p className="mt-1 font-body text-xs text-text-secondary">
            {accionOperativa === "asignar_conductor"
              ? "Abre el folio sin conductor y usa el bloque de asignación del pasaporte."
              : "Abre el folio activo y registra la incidencia desde su seguimiento operativo."}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label className="sr-only" htmlFor="buscar-traslados">Buscar traslados</label>
        <input
          id="buscar-traslados"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por folio, vehículo, conductor o placa…"
          className="flex-1 rounded-lg border border-ink/20 bg-surface-primary px-3.5 py-2.5 font-body text-sm text-ink placeholder:text-text-tertiary focus:border-focus-default focus:outline-none focus:ring-2 focus:ring-focus-default/20"
        />
        {busqueda && (
          <button
            onClick={() => setBusqueda("")}
            className="font-body text-sm text-text-tertiary hover:text-ink"
            aria-label="Limpiar búsqueda"
          >
            Limpiar
          </button>
        )}
      </div>

      <AdminPanel className="admin-table-card mt-3">
        <table>
          <caption className="sr-only">Lista de traslados operativos</caption>
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-text-tertiary">
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Vehículo</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Conductor</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-tertiary">
                  Cargando…
                </td>
              </tr>
            ) : trasladosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-text-tertiary">
                  {busqueda.trim() ? "No encontramos traslados con esa búsqueda." : "No hay traslados en esta pestaña."}
                </td>
              </tr>
            ) : (
              trasladosFiltrados.map((v, indice) => {
                const trazabilidad = v.traslado_id ? trazabilidadPorTraslado.get(v.traslado_id) : null;
                return (
                <tr key={v.traslado_id ?? `traslado-sin-folio-${indice}`}>
                  <td className="px-4 py-3" data-label="Folio">
                    {v.traslado_id ? (
                      <Link href={`/viajes/${v.traslado_id}`} className="font-mono-ruum text-admin-tabla text-status-info hover:underline">
                        {v.traslado_id.slice(0, 8).toUpperCase()}
                      </Link>
                    ) : (
                      <span className="text-text-tertiary">Sin folio</span>
                    )}
                  </td>
                  <td className="px-4 py-3" data-label="Vehículo">
                    {v.vehiculo_marca} {v.vehiculo_modelo}
                    {v.vehiculo_tipo && <span className="text-text-tertiary"> · {ETIQUETA_TIPO_VEHICULO[v.vehiculo_tipo]}</span>}
                  </td>
                  <td className="px-4 py-3" data-label="Origen">
                    {trazabilidad ? (
                      <div className="grid gap-1">
                        <span className="w-fit rounded-full border border-route-dark/25 bg-route-soft px-2.5 py-1 font-body text-xs font-semibold text-route-dark">
                          Masivo
                        </span>
                        <span className="font-mono-ruum text-admin-secundario text-text-tertiary">
                          {trazabilidad.fila.referencia_externa ?? trazabilidad.carga.nombre_archivo}
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-tertiary">Individual</span>
                    )}
                  </td>
                  <td className="px-4 py-3" data-label="Conductor">{v.conductor_nombre ?? <span className="text-text-tertiary">Sin asignar</span>}</td>
                  <td className="px-4 py-3 font-mono-ruum" data-label="Monto">${v.precio_cotizado?.toLocaleString("es-MX") ?? "—"}</td>
                  <td className="px-4 py-3" data-label="Estatus">
                    {v.estado ? <EstadoBadge estado={v.estado} /> : <span className="text-text-tertiary">Sin estado</span>}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </AdminPanel>
    </main>
  );
}

function esFiltroKpi(valor: string | null): valor is FiltroKpi {
  return valor === "activos" ||
    valor === "inician_60" ||
    valor === "sin_asignacion" ||
    valor === "incidencia" ||
    valor === "finalizados_hoy";
}

function esAccionOperativa(valor: string | null): valor is AccionOperativa {
  return valor === "asignar_conductor" || valor === "registrar_incidencia";
}
