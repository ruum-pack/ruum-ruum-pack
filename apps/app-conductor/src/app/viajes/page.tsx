"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aviso, Button } from "@ruum/ui";
import type { Conductor } from "@ruum/shared/types";
import type { MotivoRechazo } from "@ruum/shared/constants";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerUbicacionActualConEstado, type Coordenadas } from "../../lib/ubicacion";
import {
  listarViajesDisponibles,
  listarViajesAceptados,
  aceptarViaje,
  obtenerConductorActual,
  listarHistorialViajesConductor,
  registrarEvento
} from "@ruum/api/services";
import { DriverTripsList } from "./DriverTripsList";
import { RejectTripDialog } from "./RejectTripDialog";
import { TripHistoryList } from "./TripHistoryList";
import { TripOpportunityList } from "./TripOpportunityList";
import { TripsCalendar } from "./TripsCalendar";
import { TripsFilters } from "./TripsFilters";
import { TripsHeader } from "./TripsHeader";
import { TripsTabs } from "./TripsTabs";
import {
  claveDia,
  clasificarMisViajes,
  crearCalendario,
  detalleFallback,
  estadoEconomicoDeViaje,
  filtrarPorEstado,
  filtrarPorFecha,
  formatearActualizacion,
  normalizarFecha,
  normalizarGrupo,
  normalizarVista,
  type DetalleOperativo,
  type EstadoTraslado,
  type EstadoUbicacionOportunidades,
  type FiltroFecha,
  type GrupoMisViajes,
  type PasaporteRow,
  type VistaViajes
} from "./trips-utils";

type RechazoPendiente = {
  viaje: PasaporteRow;
  motivo: MotivoRechazo;
};

function TripsLoadingList() {
  return (
    <div aria-label="Cargando viajes" aria-busy="true" className="grid gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-card border border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-surface-elevated" />
              <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-elevated" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-9 animate-pulse rounded-lg bg-surface-elevated" />
            <div className="h-9 animate-pulse rounded-lg bg-surface-elevated" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTripsState({ vista }: { vista: VistaViajes }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center font-body text-sm text-text-tertiary">
      {vista === "disponibles" && "No hay viajes disponibles por ahora."}
      {vista === "mis-viajes" && "No hay viajes en esta categoría con los filtros actuales."}
      {vista === "historial" && "No hay viajes finalizados con los filtros actuales."}
    </p>
  );
}

function OpportunityLocationPanel({
  estado,
  actualizadaEn,
  onUpdate
}: {
  estado: EstadoUbicacionOportunidades;
  actualizadaEn: Date | null;
  onUpdate: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-route-action bg-route-soft px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-body text-sm font-semibold text-text-primary">Distancia aproximada al origen</p>
          <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
            Usamos tu ubicación una vez para mostrar distancia en línea recta hacia la recolección. No es ETA vial y no se actualiza en continuo.
          </p>
          {estado === "lista" && (
            <p className="mt-1 font-body text-sm text-text-secondary">
              Actualización aproximada: {formatearActualizacion(actualizadaEn)}
            </p>
          )}
          {estado === "denegada" && (
            <p className="mt-1 font-body text-sm leading-6 text-danger-action">
              Activa la ubicación en permisos del navegador o del sistema para ver la distancia aproximada al origen.
            </p>
          )}
          {estado === "no_disponible" && (
            <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
              No pudimos obtener tu ubicación. Revisa señal, permisos o intenta de nuevo.
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={onUpdate}
          disabled={estado === "solicitando"}
        >
          {estado === "solicitando" ? "Obteniendo ubicación..." : estado === "lista" ? "Actualizar ubicación" : "Usar mi ubicación"}
        </Button>
      </div>
    </div>
  );
}

export default function PaginaViajes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [diaSeleccionado, setDiaSeleccionado] = useState("");
  const [diaHoy, setDiaHoy] = useState("");
  const [disponibles, setDisponibles] = useState<PasaporteRow[]>([]);
  const [rechazados, setRechazados] = useState<string[]>([]);
  const [aceptados, setAceptados] = useState<PasaporteRow[]>([]);
  const [historial, setHistorial] = useState<PasaporteRow[]>([]);
  const [detalles, setDetalles] = useState<Record<string, DetalleOperativo>>({});
  const [cargando, setCargando] = useState(true);
  const [aceptando, setAceptando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conductor, setConductor] = useState<Conductor | null>(null);
  const [viajeParaRechazar, setViajeParaRechazar] = useState<PasaporteRow | null>(null);
  const [rechazoPendiente, setRechazoPendiente] = useState<RechazoPendiente | null>(null);
  const [ubicacionOportunidades, setUbicacionOportunidades] = useState<{
    estado: EstadoUbicacionOportunidades;
    coordenadas: Coordenadas | null;
    actualizadaEn: Date | null;
  }>({ estado: "sin_solicitar", coordenadas: null, actualizadaEn: null });
  const timeoutRechazoRef = useRef<number | null>(null);

  const vista = normalizarVista(searchParams.get("vista"));
  const grupo = normalizarGrupo(searchParams.get("grupo"));
  const filtroFecha = normalizarFecha(searchParams.get("fecha"));
  const filtroEstado = searchParams.get("estado") ?? "todos";
  const queryActual = searchParams.toString();
  const rutaActual = queryActual ? `/viajes?${queryActual}` : "/viajes";

  function actualizarUrl(cambios: Partial<Record<"vista" | "grupo" | "fecha" | "estado", string>>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(cambios).forEach(([clave, valor]) => {
      if (!valor || valor === "todos" || (clave === "grupo" && cambios.vista !== "mis-viajes")) {
        params.delete(clave);
      } else {
        params.set(clave, valor);
      }
    });

    if ((cambios.vista && cambios.vista !== "mis-viajes") || normalizarVista(params.get("vista")) !== "mis-viajes") {
      params.delete("grupo");
    }

    const query = params.toString();
    router.replace(query ? `/viajes?${query}` : "/viajes", { scroll: false });
  }

  function hrefDetalle(viaje: PasaporteRow) {
    return `/viajes/${viaje.traslado_id}?volver=${encodeURIComponent(rutaActual)}`;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hoy = claveDia(new Date());
      setDiaHoy(hoy);
      setDiaSeleccionado((actual) => actual || hoy);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function actualizarUbicacionOportunidades() {
    setUbicacionOportunidades((prev) => ({ ...prev, estado: "solicitando" }));
    const resultado = await obtenerUbicacionActualConEstado();
    if (resultado.estado === "ok") {
      setUbicacionOportunidades({
        estado: "lista",
        coordenadas: resultado.coordenadas,
        actualizadaEn: new Date()
      });
      return;
    }

    setUbicacionOportunidades({
      estado: resultado.estado === "denegado" ? "denegada" : "no_disponible",
      coordenadas: null,
      actualizadaEn: null
    });
  }

  useEffect(() => {
    return () => {
      if (timeoutRechazoRef.current) {
        window.clearTimeout(timeoutRechazoRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function cargar() {
      if (!tieneSupabaseConfigurado()) {
        setAviso("Supabase no está configurado. No se pueden consultar viajes reales.");
        setCargando(false);
        return;
      }

      try {
        const cliente = crearClienteNavegador();
        const real = await obtenerConductorActual(cliente);
        const conductorActual: Conductor | null = real
          ? {
              id: real.id,
              nombre: real.nombre,
              estado: real.estado,
              calificacion_promedio: real.calificacion_promedio,
              traslados_completados: real.traslados_completados,
              suspensiones_activas: real.suspensiones_activas,
              no_presentaciones_6m: real.no_presentaciones_6m,
              cancelaciones_sin_justificacion_count: real.cancelaciones_sin_justificacion_count,
              documentos_vigentes: real.documentos_vigentes,
              certificaciones: [],
              incidencias_graves_6m: real.incidencias_graves_6m,
              incidencias_graves_12m: real.incidencias_graves_12m,
              creado_en: real.creado_en
            }
          : null;

        if (conductorActual) setConductor(conductorActual);

        const [listaDisponibles, listaAceptados, historialViajes] = await Promise.all([
          listarViajesDisponibles(cliente),
          conductorActual ? listarViajesAceptados(cliente, conductorActual.id) : Promise.resolve([]),
          conductorActual ? listarHistorialViajesConductor(cliente, conductorActual.id) : Promise.resolve([])
        ]);

        const todos = [...listaDisponibles, ...listaAceptados];
        if (todos.length > 0) {
          const ids = todos.map((viaje) => viaje.traslado_id);
          const { data } = await cliente
            .from("traslados")
            .select("id, origen_ciudad, origen_direccion, destino_ciudad, destino_direccion, fecha_hora_programada, tipo_servicio, motivo_servicio, instrucciones_especiales")
            .in("id", ids);
          const detallesReales = Object.fromEntries(
            (data ?? []).map((fila) => {
              const viaje = todos.find((item) => item.traslado_id === fila.id);
              return [
                fila.id,
                {
                  origen: `${fila.origen_ciudad} · ${fila.origen_direccion}`,
                  destino: `${fila.destino_ciudad} · ${fila.destino_direccion}`,
                  fechaHora: fila.fecha_hora_programada ?? new Date().toISOString(),
                  tipoServicio: fila.motivo_servicio ?? fila.tipo_servicio ?? "Traslado estándar",
                  requisitos: fila.instrucciones_especiales ?? "Sin requisitos especiales.",
                  distanciaKm: viaje?.distancia_km ?? null,
                  tiempoEstimadoHoras: viaje?.tiempo_estimado_horas ?? null,
                  gananciaConductorOficial: null,
                  estadoEconomico: viaje ? estadoEconomicoDeViaje(viaje) : "sin_calcular"
                } satisfies DetalleOperativo
              ];
            })
          );
          setDetalles((prev) => ({ ...prev, ...detallesReales }));
        }

        setDisponibles(listaDisponibles);
        setAceptados(listaAceptados);
        setHistorial(historialViajes);
        if (!conductorActual) {
          setAviso("Inicia sesión como conductor para aceptar y ver tus viajes.");
        }
      } catch (err) {
        setAviso(traducirErrorOperativo(err, "No pudimos cargar los viajes."));
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  async function aceptar(trasladoId: string) {
    setAceptando(trasladoId);
    setAviso(null);

    try {
      if (!conductor) throw new Error("Inicia sesión como conductor para aceptar viajes.");
      const cliente = crearClienteNavegador();
      await aceptarViaje(cliente, trasladoId, conductor.id);
      const aceptado = disponibles.find((v) => v.traslado_id === trasladoId);
      setDisponibles((prev) => prev.filter((v) => v.traslado_id !== trasladoId));
      if (aceptado) setAceptados((prev) => [{ ...aceptado, estado: "conductor_asignado" }, ...prev]);
      setAviso("Viaje agregado a Próximos.");
    } catch (err) {
      setAviso(traducirErrorOperativo(err, "No pudimos aceptar el viaje. Intenta de nuevo."));
    } finally {
      setAceptando(null);
    }
  }

  async function persistirRechazo(pendiente: RechazoPendiente) {
    if (!conductor) throw new Error("Inicia sesión como conductor para rechazar viajes.");
    const cliente = crearClienteNavegador();
    await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductor.id, {
      traslado_id: pendiente.viaje.traslado_id,
      accion: "rechazo_oferta_conductor",
      motivo: pendiente.motivo
    });
    setRechazoPendiente(null);
    setAviso("Rechazo registrado.");
  }

  function confirmarRechazo(motivo: MotivoRechazo) {
    if (!viajeParaRechazar || rechazoPendiente) return;

    const pendiente = { viaje: viajeParaRechazar, motivo };
    setViajeParaRechazar(null);
    setRechazados((prev) => [...prev, viajeParaRechazar.traslado_id]);
    setDisponibles((prev) => prev.filter((viaje) => viaje.traslado_id !== viajeParaRechazar.traslado_id));
    setRechazoPendiente(pendiente);
    setAviso(null);

    timeoutRechazoRef.current = window.setTimeout(() => {
      void persistirRechazo(pendiente).catch((err) => {
        setAviso(traducirErrorOperativo(err, "No pudimos registrar el rechazo."));
      });
    }, 5000);
  }

  function deshacerRechazo() {
    if (!rechazoPendiente) return;
    if (timeoutRechazoRef.current) {
      window.clearTimeout(timeoutRechazoRef.current);
      timeoutRechazoRef.current = null;
    }

    const { viaje } = rechazoPendiente;
    setDisponibles((prev) => prev.some((item) => item.traslado_id === viaje.traslado_id) ? prev : [viaje, ...prev]);
    setRechazados((prev) => prev.filter((id) => id !== viaje.traslado_id));
    setRechazoPendiente(null);
    setAviso("Rechazo deshecho. El viaje volvió a estar disponible.");
  }

  const disponiblesVisibles = disponibles.filter((viaje) => !rechazados.includes(viaje.traslado_id));
  const misViajesPorGrupo: Record<GrupoMisViajes, PasaporteRow[]> = {
    "en-curso": aceptados.filter((viaje) => clasificarMisViajes(viaje) === "en-curso"),
    proximos: aceptados.filter((viaje) => clasificarMisViajes(viaje) === "proximos"),
    "por-cerrar": aceptados.filter((viaje) => clasificarMisViajes(viaje) === "por-cerrar")
  };
  const listaBase = vista === "disponibles" ? disponiblesVisibles : vista === "historial" ? historial : misViajesPorGrupo[grupo];
  const lista = filtrarPorEstado(filtrarPorFecha(listaBase, detalles, filtroFecha), filtroEstado);
  const estadosFiltro = Array.from(new Set(listaBase.map((viaje) => viaje.estado as EstadoTraslado))).sort();
  const estadisticasCompletas = {
    enCurso: misViajesPorGrupo["en-curso"].length,
    proximos: misViajesPorGrupo.proximos.length,
    porCerrar: misViajesPorGrupo["por-cerrar"].length,
    disponibles: disponiblesVisibles.length,
    historial: historial.length
  };
  const calendario = crearCalendario(disponiblesVisibles, aceptados, detalles);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <TripsHeader />
      <TripsCalendar
        calendario={calendario}
        diaSeleccionado={diaSeleccionado}
        diaHoy={diaHoy}
        estadisticas={estadisticasCompletas}
        detalles={detalles}
        hrefDetalle={hrefDetalle}
        onSelectDay={setDiaSeleccionado}
      />

      <section className="mt-6">
        <TripsTabs
          vista={vista}
          grupo={grupo}
          estadisticas={estadisticasCompletas}
          aceptadosCount={aceptados.length}
          onChange={actualizarUrl}
        />
        <TripsFilters
          filtroFecha={filtroFecha as FiltroFecha}
          filtroEstado={filtroEstado}
          estadosFiltro={estadosFiltro}
          onChange={actualizarUrl}
        />

        {vista === "disponibles" && (
          <OpportunityLocationPanel
            estado={ubicacionOportunidades.estado}
            actualizadaEn={ubicacionOportunidades.actualizadaEn}
            onUpdate={actualizarUbicacionOportunidades}
          />
        )}

        {aviso && (
          <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
            <Aviso tono="info">{aviso}</Aviso>
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {cargando ? (
            <TripsLoadingList />
          ) : lista.length === 0 ? (
            <EmptyTripsState vista={vista} />
          ) : vista === "disponibles" ? (
            <TripOpportunityList
              viajes={lista}
              detalles={detalles}
              conductor={conductor}
              aceptando={aceptando}
              rechazoPendiente={Boolean(rechazoPendiente)}
              coordenadas={ubicacionOportunidades.coordenadas}
              hrefDetalle={hrefDetalle}
              onAccept={(trasladoId) => void aceptar(trasladoId)}
            />
          ) : vista === "mis-viajes" ? (
            <DriverTripsList viajes={lista} detalles={detalles} hrefDetalle={hrefDetalle} />
          ) : (
            <TripHistoryList viajes={lista} detalles={detalles} hrefDetalle={hrefDetalle} />
          )}
        </div>
      </section>

      <RejectTripDialog
        viaje={viajeParaRechazar}
        onClose={() => setViajeParaRechazar(null)}
        onConfirm={confirmarRechazo}
      />

      {rechazoPendiente && (
        <div
          role="status"
          aria-live="polite"
          className="conductor-toast-bottom fixed inset-x-4 z-50 rounded-xl border border-border bg-surface-strong px-4 py-3 text-surface shadow-[0_18px_50px_rgba(26,31,46,0.28)] sm:left-auto sm:right-6 sm:w-[360px]"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-sm font-semibold">Viaje rechazado</p>
              <p className="mt-0.5 font-body text-xs text-text-secondary">{rechazoPendiente.motivo}</p>
            </div>
            <button
              type="button"
              onClick={deshacerRechazo}
              className="min-h-11 rounded-lg bg-surface px-3 py-2 font-body text-xs font-bold text-text-primary"
            >
              Deshacer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
