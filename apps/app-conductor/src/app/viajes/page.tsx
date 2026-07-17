"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Aviso, Card, TripCard, EstadoBadge, DriverEarning } from "@ruum/ui";
import { ETIQUETA_TIPO_VEHICULO, GLOSARIO_OPERATIVO, MOTIVOS_RECHAZO, type EstadoEconomicoExplicito, type MotivoRechazo } from "@ruum/shared/constants";
import { esElegibleParaViaje } from "@ruum/shared/rules";
import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import type { Database, Conductor } from "@ruum/shared/types";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";
import { obtenerUbicacionActualConEstado, type Coordenadas } from "../../lib/ubicacion";
import { getTripPresentation } from "../../lib/trip-presentation";
import {
  listarViajesDisponibles,
  listarViajesAceptados,
  aceptarViaje,
  obtenerConductorActual,
  listarHistorialViajesConductor,
  registrarEvento
} from "@ruum/api/services";
import { ESTADOS_QUE_REQUIEREN_EVIDENCIA } from "./[id]/AccionesViaje";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type VistaViajes = "disponibles" | "mis-viajes" | "historial";
type GrupoMisViajes = "en-curso" | "proximos" | "por-cerrar";
type FiltroFecha = "todos" | "hoy" | "semana";

interface DetalleOperativo {
  origen: string;
  destino: string;
  fechaHora: string;
  tipoServicio: string;
  requisitos: string;
  distanciaKm: number | null;
  tiempoEstimadoHoras: number | null;
  gananciaConductorOficial: number | null;
  estadoEconomico: EstadoEconomicoExplicito;
}

type RechazoPendiente = {
  viaje: PasaporteRow;
  motivo: MotivoRechazo;
};

type EstadoUbicacionOportunidades = "sin_solicitar" | "solicitando" | "lista" | "denegada" | "no_disponible";
type ViajeCalendario = { viaje: PasaporteRow; tipo: string };
type DiaCalendario = { dia: Date; viajes: ViajeCalendario[] };

const ZONA_HORARIA_VIAJE = "America/Mexico_City";

const VISTAS: { id: VistaViajes; etiqueta: string }[] = [
  { id: "disponibles", etiqueta: "Disponibles" },
  { id: "mis-viajes", etiqueta: "Mis viajes" },
  { id: "historial", etiqueta: "Historial" }
];

const GRUPOS_MIS_VIAJES: { id: GrupoMisViajes; etiqueta: string }[] = [
  { id: "en-curso", etiqueta: "En curso" },
  { id: "proximos", etiqueta: "Próximos" },
  { id: "por-cerrar", etiqueta: "Por cerrar" }
];

const FILTROS_FECHA: { id: FiltroFecha; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todas las fechas" },
  { id: "hoy", etiqueta: "Hoy" },
  { id: "semana", etiqueta: "Esta semana" }
];

const ESTADOS_FINALIZADOS = new Set<EstadoTraslado>([
  "servicio_cerrado",
  "servicio_cancelado",
  "traslado_fallido",
  "reclamo_resuelto",
  "disputa_resuelta"
]);

const ESTADOS_PROXIMOS = new Set<EstadoTraslado>(["conductor_asignado"]);

const ESTADOS_POR_CERRAR = new Set<EstadoTraslado>([
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada",
  "pago_pendiente",
  "pago_completado",
  "dano_no_reportado_en_revision",
  "reclamo_abierto",
  "cierre_operativo_con_incidencia_abierta",
  "disputa_abierta"
]);

function detalleFallback(viaje: PasaporteRow): DetalleOperativo {
  return {
    origen: "Origen por confirmar",
    destino: "Destino por confirmar",
    fechaHora: viaje.creado_en,
    tipoServicio: "Traslado estándar",
    requisitos: viaje.vehiculo_tipo ? `Nivel compatible con ${ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}.` : "Sin requisitos especiales.",
    distanciaKm: viaje.distancia_km,
    tiempoEstimadoHoras: viaje.tiempo_estimado_horas,
    gananciaConductorOficial: null,
    estadoEconomico: estadoEconomicoDeViaje(viaje)
  };
}

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(new Date(fecha));
}

function formatearDiaCalendario(fecha: Date) {
  return formatearFecha(fecha.toISOString());
}

function formatearDiaSelector(fecha: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(fecha);
}

function claveDia(fecha: string | Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).formatToParts(fecha instanceof Date ? fecha : new Date(fecha));
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function formatearHora(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(new Date(fecha));
}

function formatearDistancia(km: number | null) {
  if (km == null || !Number.isFinite(km)) return "Por confirmar";
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

function formatearDuracion(horas: number | null) {
  if (horas == null || !Number.isFinite(horas)) return "Por confirmar";
  const minutos = Math.max(1, Math.round(horas * 60));
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function distanciaKmEntre(a: Coordenadas, b: { lat: number | null; lng: number | null }) {
  if (b.lat == null || b.lng == null) return null;
  const radioTierraKm = 6371;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radioTierraKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function etaMinutosAlOrigen(distanciaKm: number | null) {
  if (distanciaKm == null) return null;
  // Estimación conservadora urbana para ordenar oportunidades sin usar tracking continuo.
  return Math.max(2, Math.round((distanciaKm / 25) * 60));
}

function formatearActualizacion(fecha: Date | null) {
  if (!fecha) return "Sin actualizar";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(fecha);
}

function inicioSemanaDomingo(fecha = new Date()) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - inicio.getDay());
  return inicio;
}

function estaSemanaActual(fechaIso: string) {
  const inicio = inicioSemanaDomingo();
  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 7);
  const fecha = new Date(fechaIso);
  return fecha >= inicio && fecha < fin;
}

function diasSemanaActual() {
  const inicio = inicioSemanaDomingo();
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });
}

function mismoDia(a: string, b: Date) {
  return claveDia(a) === claveDia(b);
}

function esHoy(fechaIso: string) {
  return claveDia(fechaIso) === claveDia(new Date());
}

function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

function normalizarVista(valor: string | null): VistaViajes {
  return VISTAS.some((vista) => vista.id === valor) ? (valor as VistaViajes) : "disponibles";
}

function normalizarGrupo(valor: string | null): GrupoMisViajes {
  return GRUPOS_MIS_VIAJES.some((grupo) => grupo.id === valor) ? (valor as GrupoMisViajes) : "en-curso";
}

function normalizarFecha(valor: string | null): FiltroFecha {
  return FILTROS_FECHA.some((fecha) => fecha.id === valor) ? (valor as FiltroFecha) : "todos";
}

function clasificarMisViajes(viaje: PasaporteRow): GrupoMisViajes | null {
  const estado = viaje.estado as EstadoTraslado;
  if (ESTADOS_FINALIZADOS.has(estado)) return null;
  if (ESTADOS_PROXIMOS.has(estado)) return "proximos";
  if (ESTADOS_POR_CERRAR.has(estado)) return "por-cerrar";
  return "en-curso";
}

function filtrarPorFecha(viajes: PasaporteRow[], detalles: Record<string, DetalleOperativo>, filtro: FiltroFecha) {
  if (filtro === "todos") return viajes;
  return viajes.filter((viaje) => {
    const fecha = (detalles[viaje.traslado_id] ?? detalleFallback(viaje)).fechaHora;
    if (filtro === "hoy") return esHoy(fecha);
    return estaSemanaActual(fecha);
  });
}

function filtrarPorEstado(viajes: PasaporteRow[], estado: string) {
  if (!estado || estado === "todos") return viajes;
  return viajes.filter((viaje) => viaje.estado === estado);
}

function estadoEconomicoDeViaje(viaje: PasaporteRow): EstadoEconomicoExplicito {
  if (viaje.estado === "servicio_cancelado" || viaje.estado === "traslado_fallido") return "rechazado";
  if (viaje.estado === "servicio_cerrado" || viaje.estado === "pago_pendiente" || viaje.estado === "pago_completado") return "en_validacion";
  if (viaje.estado === "conductor_asignado" || viaje.estado === "pendiente_de_conductor") return "programado";
  return "sin_calcular";
}

function WeekDaySelector({
  dias,
  seleccionado,
  hoy,
  onSelect
}: {
  dias: DiaCalendario[];
  seleccionado: string;
  hoy: string;
  onSelect: (clave: string) => void;
}) {
  return (
    <div className="sm:hidden">
      <div className="-mx-4 overflow-x-auto px-4 pb-2" aria-label="Días de la semana">
        <div className="flex min-w-max gap-2">
          {dias.map(({ dia, viajes }) => {
            const clave = claveDia(dia);
            const activo = clave === seleccionado;
            const esHoy = clave === hoy;
            return (
              <button
                key={clave}
                type="button"
                aria-current={activo ? "date" : undefined}
                onClick={() => onSelect(clave)}
                className={[
                  "min-h-28 w-32 rounded-xl border px-3 py-3 text-left transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action",
                  activo ? "border-route-action bg-route-soft shadow-[inset_0_0_0_2px_rgba(31,91,72,0.22)]" : "border-border bg-surface"
                ].join(" ")}
              >
                <span className="block font-body text-sm font-bold capitalize text-text-primary">
                  {esHoy ? "Hoy" : formatearDiaSelector(dia)}
                </span>
                <span className="mt-1 block font-body text-sm text-text-secondary">{viajes.length} viaje(s)</span>
                <span className="mt-3 block min-h-5 font-body text-xs font-semibold text-route-action">
                  {activo ? "Seleccionado" : esHoy ? "Día actual" : "Ver día"}
                </span>
              </button>
            );
          })}
        </div>
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
  const rutaActual = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/viajes?${query}` : "/viajes";
  }, [searchParams]);

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
    const hoy = claveDia(new Date());
    setDiaHoy(hoy);
    setDiaSeleccionado((actual) => actual || hoy);
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
        setAviso(err instanceof Error ? err.message : "No pudimos cargar los viajes.");
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
      setAviso(`Viaje agregado a ${GLOSARIO_OPERATIVO.aceptado.toLowerCase()}s.`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No pudimos aceptar el viaje. Intenta de nuevo.");
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
        setAviso(err instanceof Error ? err.message : "No pudimos registrar el rechazo.");
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
  const misViajesPorGrupo = useMemo(() => ({
    "en-curso": aceptados.filter((viaje) => clasificarMisViajes(viaje) === "en-curso"),
    proximos: aceptados.filter((viaje) => clasificarMisViajes(viaje) === "proximos"),
    "por-cerrar": aceptados.filter((viaje) => clasificarMisViajes(viaje) === "por-cerrar")
  }), [aceptados]);
  const listaBase = vista === "disponibles" ? disponiblesVisibles : vista === "historial" ? historial : misViajesPorGrupo[grupo];
  const lista = filtrarPorEstado(filtrarPorFecha(listaBase, detalles, filtroFecha), filtroEstado);
  const estadosFiltro = useMemo(() => {
    const estados = Array.from(new Set(listaBase.map((viaje) => viaje.estado as EstadoTraslado))).sort();
    return estados;
  }, [listaBase]);
  const estadisticasCompletas = useMemo(() => {
    return {
      enCurso: misViajesPorGrupo["en-curso"].length,
      proximos: misViajesPorGrupo.proximos.length,
      porCerrar: misViajesPorGrupo["por-cerrar"].length,
      disponibles: disponiblesVisibles.length,
      historial: historial.length
    };
  }, [disponiblesVisibles.length, historial.length, misViajesPorGrupo]);
  const calendario = useMemo(() => {
    const todos = [
      ...disponiblesVisibles.map((viaje) => ({ viaje, tipo: "Ofertado" })),
      ...aceptados.map((viaje) => ({ viaje, tipo: GLOSARIO_OPERATIVO.aceptado }))
    ];
    return diasSemanaActual().map((dia) => ({
      dia,
      viajes: todos.filter(({ viaje }) => mismoDia((detalles[viaje.traslado_id] ?? detalleFallback(viaje)).fechaHora, dia))
    }));
  }, [aceptados, detalles, disponiblesVisibles]);
  const diaCalendarioSeleccionado = calendario.find(({ dia }) => claveDia(dia) === diaSeleccionado) ?? calendario[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/panel" className="font-body text-sm text-text-secondary underline-offset-4 hover:underline">
            Panel
          </Link>
          <h1 className="mt-2 font-display text-3xl font-semibold">Traslados</h1>
          <p className="mt-2 font-body text-sm text-text-secondary">
            Centro operativo para aceptar viajes, consultar procesos activos y planear tu semana.
          </p>
        </div>
      </header>

      <section className="mt-6">
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Calendario semanal</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Semana actual · inicia en domingo</h2>
            </div>
            <p className="font-body text-xs leading-5 text-text-tertiary">Horario del viaje: {ZONA_HORARIA_VIAJE}</p>
          </div>

          <div className="mt-5 sm:hidden">
            <WeekDaySelector dias={calendario} seleccionado={diaSeleccionado} hoy={diaHoy} onSelect={setDiaSeleccionado} />
            {diaCalendarioSeleccionado && (
              <div className="mt-4 rounded-xl border border-border bg-surface-elevated px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-body text-sm font-bold capitalize">{formatearDiaCalendario(diaCalendarioSeleccionado.dia)}</p>
                    <p className="mt-1 font-body text-sm text-text-secondary">{diaCalendarioSeleccionado.viajes.length} viaje(s) programado(s)</p>
                  </div>
                  {claveDia(diaCalendarioSeleccionado.dia) === diaHoy && (
                    <span className="rounded-full border border-route-action bg-route-soft px-2.5 py-1 font-body text-xs font-bold text-route-action">
                      Hoy
                    </span>
                  )}
                </div>
                <div className="mt-4 grid gap-2">
                  {diaCalendarioSeleccionado.viajes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-3 font-body text-sm text-text-tertiary">
                      No hay viajes para este día.
                    </p>
                  ) : (
                    diaCalendarioSeleccionado.viajes.map(({ viaje, tipo }) => {
                      const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
                      return (
                        <Link
                          key={`${tipo}-${viaje.traslado_id}`}
                          href={hrefDetalle(viaje)}
                          className="rounded-lg border border-border bg-surface px-3 py-3 font-body text-sm hover:border-route-action hover:bg-route-soft"
                        >
                          <span className="block font-semibold">{tipo}: {nombreVehiculo(viaje)}</span>
                          <span className="mt-1 block text-text-secondary">{formatearHora(detalle.fechaHora)} · {detalle.origen}</span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            <details className="mt-3 rounded-xl border border-border bg-surface">
              <summary className="cursor-pointer px-4 py-3 font-body text-sm font-bold text-route-action">
                Ver semana
              </summary>
              <div className="grid gap-2 border-t border-border px-4 py-3">
                {calendario.map(({ dia, viajes }) => (
                  <button
                    key={claveDia(dia)}
                    type="button"
                    onClick={() => setDiaSeleccionado(claveDia(dia))}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left font-body text-sm"
                  >
                    <span className="font-semibold capitalize">{formatearDiaCalendario(dia)}</span>
                    <span className="font-body text-xs font-semibold text-text-secondary">{viajes.length} viaje(s)</span>
                  </button>
                ))}
              </div>
            </details>
          </div>

          <div className="mt-5 hidden gap-2 sm:grid sm:grid-cols-7">
            {calendario.map(({ dia, viajes }) => (
              <div
                key={claveDia(dia)}
                className={[
                  "rounded-lg border px-3 py-3 sm:min-h-28",
                  viajes.length > 0 ? "border-signal/50 bg-signal-soft/50" : "border-border bg-surface"
                ].join(" ")}
              >
                <p className="text-center font-body text-sm font-semibold capitalize sm:text-left sm:text-xs">
                  {formatearDiaCalendario(dia)}
                </p>
                <p className="mt-1 text-center font-body text-xs text-text-tertiary sm:text-left">{viajes.length} viaje(s)</p>
                <div className="mt-3 hidden gap-1 sm:grid">
                  {viajes.slice(0, 2).map(({ viaje, tipo }) => (
                    <span key={`${tipo}-${viaje.traslado_id}`} className="truncate rounded bg-surface px-2 py-1 font-body text-xs text-text-secondary">
                      {tipo}: {nombreVehiculo(viaje)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <details className="mt-4 rounded-xl border border-border bg-surface">
          <summary className="cursor-pointer px-4 py-3 font-body text-sm font-semibold text-text-secondary">
            Ver estadísticas completas
          </summary>
          <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-4">
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">En curso</p>
              <p className="mt-1 font-display text-2xl font-semibold">{estadisticasCompletas.enCurso}</p>
              <p className="font-body text-xs text-text-tertiary">operando</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Próximos</p>
              <p className="mt-1 font-display text-2xl font-semibold">{estadisticasCompletas.proximos}</p>
              <p className="font-body text-xs text-text-tertiary">programados</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Por cerrar</p>
              <p className="mt-1 font-display text-2xl font-semibold">{estadisticasCompletas.porCerrar}</p>
              <p className="font-body text-xs text-text-tertiary">requieren cierre</p>
            </div>
            <div>
              <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Disponibles</p>
              <p className="mt-1 font-display text-2xl font-semibold">{estadisticasCompletas.disponibles}</p>
              <p className="font-body text-xs text-text-tertiary">por aceptar</p>
            </div>
          </div>
        </details>
      </section>

      <section className="mt-6">
        <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Secciones de viajes">
          {VISTAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => actualizarUrl({ vista: item.id, grupo: item.id === "mis-viajes" ? grupo : "", estado: "todos" })}
              aria-pressed={vista === item.id}
              className={[
                "min-h-14 rounded-xl border px-4 py-3 text-left font-body text-sm font-semibold transition",
                vista === item.id ? "border-route-action bg-route-soft text-route-action" : "border-border bg-surface text-secondary hover:border-route-action"
              ].join(" ")}
            >
              <span>{item.etiqueta}</span>
              <span className="mt-1 block font-body text-xs text-text-tertiary">
                {item.id === "disponibles" && `${estadisticasCompletas.disponibles} por aceptar`}
                {item.id === "mis-viajes" && `${aceptados.length} aceptado(s)`}
                {item.id === "historial" && `${estadisticasCompletas.historial} finalizado(s)`}
              </span>
            </button>
          ))}
        </div>

        {vista === "mis-viajes" && (
          <div className="mt-3 grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Mis viajes">
            {GRUPOS_MIS_VIAJES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => actualizarUrl({ vista: "mis-viajes", grupo: item.id, estado: "todos" })}
                aria-pressed={grupo === item.id}
                className={[
                  "min-h-12 rounded-lg border px-3 py-2 text-left font-body text-sm font-semibold transition",
                  grupo === item.id ? "border-success bg-control-soft text-success" : "border-border bg-surface-elevated text-secondary hover:border-success"
                ].join(" ")}
              >
                {item.etiqueta}
                <span className="ml-2 font-body text-xs text-text-tertiary">
                  {item.id === "en-curso" && estadisticasCompletas.enCurso}
                  {item.id === "proximos" && estadisticasCompletas.proximos}
                  {item.id === "por-cerrar" && estadisticasCompletas.porCerrar}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface px-4 py-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="font-body text-sm font-semibold text-text-tertiary">Fecha</span>
            <select
              value={filtroFecha}
              onChange={(event) => actualizarUrl({ fecha: event.target.value })}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base"
            >
              {FILTROS_FECHA.map((item) => (
                <option key={item.id} value={item.id}>{item.etiqueta}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="font-body text-sm font-semibold text-text-tertiary">Estado</span>
            <select
              value={estadosFiltro.includes(filtroEstado as EstadoTraslado) ? filtroEstado : "todos"}
              onChange={(event) => actualizarUrl({ estado: event.target.value })}
              className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base"
            >
              <option value="todos">Todos los estados</option>
              {estadosFiltro.map((estado) => (
                <option key={estado} value={estado}>{ETIQUETA_ESTADO_TRASLADO[estado]}</option>
              ))}
            </select>
          </label>
        </div>

        {vista === "disponibles" && (
          <div className="mt-3 rounded-xl border border-route-action bg-route-soft px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-body text-sm font-semibold text-text-primary">Tiempo hacia el origen</p>
                <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
                  Usamos tu ubicación una vez para mostrar qué oportunidades están más cerca. No se actualiza en continuo.
                </p>
                {ubicacionOportunidades.estado === "lista" && (
                  <p className="mt-1 font-body text-sm text-text-secondary">
                    Actualización aproximada: {formatearActualizacion(ubicacionOportunidades.actualizadaEn)}
                  </p>
                )}
                {ubicacionOportunidades.estado === "denegada" && (
                  <p className="mt-1 font-body text-sm leading-6 text-danger-action">
                    Activa la ubicación en permisos del navegador o del sistema para ver “A X min de ti”.
                  </p>
                )}
                {ubicacionOportunidades.estado === "no_disponible" && (
                  <p className="mt-1 font-body text-sm leading-6 text-text-secondary">
                    No pudimos obtener tu ubicación. Revisa señal, permisos o intenta de nuevo.
                  </p>
                )}
              </div>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={actualizarUbicacionOportunidades}
                disabled={ubicacionOportunidades.estado === "solicitando"}
              >
                {ubicacionOportunidades.estado === "solicitando" ? "Obteniendo ubicación…" : ubicacionOportunidades.estado === "lista" ? "Actualizar ubicación" : "Usar mi ubicación"}
              </Button>
            </div>
          </div>
        )}

        {aviso && (
          <div className="mt-4" role="status" aria-live="polite" aria-atomic="true">
            <Aviso tono="info">{aviso}</Aviso>
          </div>
        )}

        <div className="mt-6 grid gap-4">
          {cargando ? (
            /* Ítem 9 — skeleton reemplaza "Cargando…" */
            <div aria-label="Cargando viajes" aria-busy="true" className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-card border border-border p-5 space-y-3">
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
          ) : lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center font-body text-sm text-text-tertiary">
              {vista === "disponibles" && "No hay viajes disponibles por ahora."}
              {vista === "mis-viajes" && "No hay viajes en esta categoría con los filtros actuales."}
              {vista === "historial" && "No hay viajes finalizados con los filtros actuales."}
            </p>
          ) : (
            lista.map((viaje) => {
              const detalle = detalles[viaje.traslado_id] ?? detalleFallback(viaje);
              const estadoActual = viaje.estado as EstadoTraslado;
              const requiereEvidencia = ESTADOS_QUE_REQUIEREN_EVIDENCIA.includes(estadoActual);
              const presentation = getTripPresentation(estadoActual);
              const etiquetaSiguientePaso = presentation.primaryAction.label;
              const elegibilidad = viaje.vehiculo_tipo
                ? conductor
                  ? esElegibleParaViaje(conductor, viaje.vehiculo_tipo, "intraurbana")
                  : { elegible: false, motivo: "Inicia sesión como conductor para validar elegibilidad." }
                : { elegible: Boolean(conductor), motivo: "Inicia sesión como conductor para aceptar viajes." };
              const requisitoExcepcional = detalle.requisitos && detalle.requisitos !== "Sin requisitos especiales." ? detalle.requisitos : null;
              const hayGanancia = detalle.gananciaConductorOficial != null;
              const etiquetaGanancia = hayGanancia
                ? detalle.estadoEconomico === "estimado" ? "Ganancia estimada" : "Ganancia confirmada"
                : "Ganancia por confirmar";
              const distanciaAlOrigenKm = ubicacionOportunidades.coordenadas
                ? distanciaKmEntre(ubicacionOportunidades.coordenadas, { lat: viaje.origen_lat, lng: viaje.origen_lng })
                : null;
              const etaAlOrigenMin = etaMinutosAlOrigen(distanciaAlOrigenKm);

              return (
                <TripCard key={viaje.traslado_id} folio={viaje.traslado_id.slice(0, 8).toUpperCase()}>
                  {vista === "disponibles" ? (
                    <article className="grid gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Oportunidad disponible</p>
                          <h2 className="mt-1 truncate font-display text-xl font-semibold">
                            {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
                          </h2>
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <div className="min-w-0">
                              <p className="font-body text-sm font-semibold text-text-tertiary">Origen</p>
                              <p className="truncate font-body text-base font-semibold text-text-primary">{detalle.origen}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="font-body text-sm font-semibold text-text-tertiary">Destino</p>
                              <p className="truncate font-body text-base font-semibold text-text-primary">{detalle.destino}</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-success bg-control-soft px-4 py-3 shadow-1 sm:min-w-56">
                          <p className="font-body text-xs uppercase tracking-wide text-success">{etiquetaGanancia}</p>
                          <DriverEarning
                            amount={detalle.gananciaConductorOficial}
                            status={detalle.estadoEconomico === "confirmado" ? "confirmado" : detalle.estadoEconomico === "estimado" ? "estimado" : "sin_calcular"}
                            currency="MXN"
                            amountClassName="font-display text-xl font-bold text-success"
                          />
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tiempo hasta origen</p>
                          <p className="font-body text-sm font-semibold">
                            {etaAlOrigenMin != null ? `A ${etaAlOrigenMin} min de ti` : "Activa ubicación"}
                          </p>
                          <p className="font-body text-xs text-text-tertiary">
                            {distanciaAlOrigenKm != null ? `${formatearDistancia(distanciaAlOrigenKm)} aprox. al origen` : "Distancia a recolección"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Distancia del traslado</p>
                          <p className="font-body text-sm font-semibold">{formatearDistancia(detalle.distanciaKm)}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-surface-elevated px-3 py-2">
                          <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">Duración estimada</p>
                          <p className="font-body text-sm font-semibold">{formatearDuracion(detalle.tiempoEstimadoHoras)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:min-w-56">
                          <Link
                            href={hrefDetalle(viaje)}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-center font-body text-sm font-semibold text-text-secondary hover:border-route-action hover:bg-route-soft hover:text-route-action"
                          >
                            Ver detalles
                          </Link>
                          <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => aceptar(viaje.traslado_id)}
                            disabled={!elegibilidad.elegible || aceptando === viaje.traslado_id || Boolean(rechazoPendiente)}
                          >
                            {aceptando === viaje.traslado_id ? "Aceptando…" : "Aceptar"}
                          </Button>
                        </div>
                      </div>

                      {requisitoExcepcional && (
                        <div className="rounded-lg border border-warning bg-warn-soft px-3 py-2 font-body text-xs font-semibold text-warning">
                          Requisito excepcional: {requisitoExcepcional}
                        </div>
                      )}

                      {!elegibilidad.elegible && (
                        <Aviso tono="atencion">No elegible: {elegibilidad.motivo}</Aviso>
                      )}

                      <details className="group rounded-lg border border-border bg-surface-elevated">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-body text-sm font-semibold text-text-secondary hover:text-route-action [&::-webkit-details-marker]:hidden">
                          Información de la oportunidad
                          <span className="font-display text-lg leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
                        </summary>
                        <div className="grid gap-4 border-t border-border px-3 py-3 font-body text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-text-tertiary">Vehículo</p>
                            <p className="mt-1 font-semibold">{nombreVehiculo(viaje)}</p>
                            <p className="text-text-secondary">{viaje.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo] : "Tipo por definir"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-text-tertiary">Contactos</p>
                            <p className="mt-1 font-semibold">{viaje.contacto_entrega_nombre ?? "Contacto de origen por confirmar"}</p>
                            <p className="text-text-secondary">{viaje.contacto_recepcion_nombre ?? "Contacto de destino por confirmar"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-text-tertiary">Condiciones</p>
                            <p className="mt-1 font-semibold">{detalle.tipoServicio}</p>
                            <p className="text-text-secondary">Distancia oficial: {formatearDistancia(detalle.distanciaKm)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-text-tertiary">Requisitos</p>
                            <p className="mt-1 font-semibold">{detalle.requisitos}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-xs uppercase tracking-wide text-text-tertiary">Política de cancelación</p>
                            <p className="mt-1 text-text-secondary">
                              Al aceptar, el viaje queda en tus próximos traslados. Si necesitas cancelar después, operación revisará el motivo y puede afectar tu disponibilidad.
                            </p>
                          </div>
                        </div>
                      </details>
                    </article>
                  ) : (
                    <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-body text-xs uppercase tracking-wide text-text-tertiary">
                        {vista === "mis-viajes" && `Viaje ${GLOSARIO_OPERATIVO.aceptado.toLowerCase()}`}
                        {vista === "historial" && "Viaje finalizado"}
                      </p>
                      <h2 className="mt-1 font-display text-xl font-semibold">
                        {nombreVehiculo(viaje)}
                        {viaje.vehiculo_tipo && (
                          <span className="ml-2 font-body text-xs font-normal text-text-tertiary">
                            · {ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}
                          </span>
                        )}
                      </h2>
                    </div>
                    <EstadoBadge estado={viaje.estado} />
                  </div>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="font-body text-sm font-semibold text-text-tertiary">Origen</dt>
                      <dd className="mt-1 font-body text-base font-medium">{detalle.origen}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-sm font-semibold text-text-tertiary">Destino</dt>
                      <dd className="mt-1 font-body text-base font-medium">{detalle.destino}</dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Fecha y hora</dt>
                      <dd className="mt-1 font-body text-sm font-medium">
                        {formatearFecha(detalle.fechaHora)} · {formatearHora(detalle.fechaHora)}
                      </dd>
                    </div>
                    {vista === "mis-viajes" && (
                      <div>
                        <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Monto conductor</dt>
                        <dd className="mt-1">
                          <DriverEarning
                            amount={detalle.gananciaConductorOficial}
                            status={detalle.estadoEconomico}
                            currency="MXN"
                            amountClassName="text-sm"
                          />
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipo de vehículo</dt>
                      <dd className="mt-1 font-body text-sm font-medium">
                        {viaje.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo] : "Por definir"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Tipo de servicio</dt>
                      <dd className="mt-1 font-body text-sm font-medium">{detalle.tipoServicio}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-body text-xs uppercase tracking-wide text-text-tertiary">Requisitos especiales</dt>
                      <dd className="mt-1 font-body text-sm font-medium">{detalle.requisitos}</dd>
                    </div>
                  </dl>

                  <div className="mt-5">
                    {vista === "mis-viajes" ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">
                        <div className="grid w-full gap-3 sm:max-w-xs">
                          <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => router.push(hrefDetalle(viaje))}
                          >
                            {etiquetaSiguientePaso}
                          </Button>
                          {requiereEvidencia && (
                            <Button
                              variant="secondary"
                              className="w-full"
                              onClick={() => router.push(`/viajes/${viaje.traslado_id}/evidencia`)}
                            >
                              Cargar registro del vehículo
                            </Button>
                          )}
                        </div>
                        <details className="relative self-end">
                          <summary
                            aria-label="Más acciones del viaje"
                            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border bg-surface font-display text-xl font-bold leading-none text-text-secondary shadow-sm transition hover:border-route-action hover:bg-route-soft hover:text-route-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-route-action [&::-webkit-details-marker]:hidden"
                          >
                            ⋮
                          </summary>
                          <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_14px_40px_rgba(26,31,46,0.16)]">
                            <Link href={hrefDetalle(viaje)} className="block px-4 py-2.5 font-body text-sm font-medium text-text-secondary hover:bg-route-soft hover:text-route-action">
                              Ver detalles
                            </Link>
                            <Link href={hrefDetalle(viaje)} className="block px-4 py-2.5 font-body text-sm font-medium text-text-secondary hover:bg-route-soft hover:text-route-action">
                              {GLOSARIO_OPERATIVO.incidencia}
                            </Link>
                            <Link href={hrefDetalle(viaje)} className="block px-4 py-2.5 font-body text-sm font-medium text-text-secondary hover:bg-route-soft hover:text-route-action">
                              Confirmar entrega
                            </Link>
                          </div>
                        </details>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Link href={hrefDetalle(viaje)} className="font-body text-sm font-medium text-text-secondary hover:text-text-primary">
                          {vista === "historial" ? "Ver viaje finalizado" : "Ver detalles completos"}
                        </Link>
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </TripCard>
              );
            })
          )}
        </div>
      </section>

      {viajeParaRechazar && (
        <div className="fixed inset-0 z-50 bg-surface-strong" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rechazo-viaje-titulo"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-5 shadow-[0_-24px_70px_rgba(26,31,46,0.22)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="rechazo-viaje-titulo" className="font-display text-lg font-semibold">
                  Motivo de rechazo
                </p>
                <p className="mt-1 font-body text-sm text-text-secondary">
                  {nombreVehiculo(viajeParaRechazar)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViajeParaRechazar(null)}
                className="min-h-11 rounded-lg border border-border px-3 py-2 font-body text-sm font-semibold text-text-secondary"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {MOTIVOS_RECHAZO.map((motivo) => (
                <button
                  key={motivo}
                  type="button"
                  onClick={() => confirmarRechazo(motivo)}
                  className="min-h-11 rounded-xl border border-border bg-surface px-4 py-3 text-left font-body text-sm font-semibold text-text-secondary transition-colors hover:border-route-action hover:bg-route-soft"
                >
                  {motivo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
