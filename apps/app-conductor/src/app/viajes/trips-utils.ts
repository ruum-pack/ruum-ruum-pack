import { ETIQUETA_TIPO_VEHICULO, GLOSARIO_OPERATIVO, type EstadoEconomicoExplicito } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import type { Coordenadas } from "../../lib/ubicacion";

export type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
export type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
export type VistaViajes = "disponibles" | "mis-viajes" | "historial";
export type GrupoMisViajes = "en-curso" | "proximos" | "por-cerrar";
export type FiltroFecha = "todos" | "hoy" | "semana";

export interface DetalleOperativo {
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

export type EstadoUbicacionOportunidades = "sin_solicitar" | "solicitando" | "lista" | "denegada" | "no_disponible";
export type ViajeCalendario = { viaje: PasaporteRow; tipo: string };
export type DiaCalendario = { dia: Date; viajes: ViajeCalendario[] };

export const ZONA_HORARIA_VIAJE = "America/Mexico_City";

export const VISTAS: { id: VistaViajes; etiqueta: string }[] = [
  { id: "disponibles", etiqueta: "Disponibles" },
  { id: "mis-viajes", etiqueta: "Mis viajes" },
  { id: "historial", etiqueta: "Historial" }
];

export const GRUPOS_MIS_VIAJES: { id: GrupoMisViajes; etiqueta: string }[] = [
  { id: "en-curso", etiqueta: "En curso" },
  { id: "proximos", etiqueta: "Próximos" },
  { id: "por-cerrar", etiqueta: "Por cerrar" }
];

export const FILTROS_FECHA: { id: FiltroFecha; etiqueta: string }[] = [
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

export function estadoEconomicoDeViaje(viaje: PasaporteRow): EstadoEconomicoExplicito {
  if (viaje.estado === "servicio_cancelado" || viaje.estado === "traslado_fallido") return "rechazado";
  if (viaje.estado === "servicio_cerrado" || viaje.estado === "pago_pendiente" || viaje.estado === "pago_completado") return "en_validacion";
  if (viaje.estado === "conductor_asignado" || viaje.estado === "pendiente_de_conductor") return "programado";
  return "sin_calcular";
}

export function detalleFallback(viaje: PasaporteRow): DetalleOperativo {
  return {
    origen: "Origen por confirmar",
    destino: "Destino por confirmar",
    fechaHora: viaje.creado_en ?? viaje.actualizado_en ?? new Date().toISOString(),
    tipoServicio: "Traslado estándar",
    requisitos: viaje.vehiculo_tipo ? `Nivel compatible con ${ETIQUETA_TIPO_VEHICULO[viaje.vehiculo_tipo]}.` : "Sin requisitos especiales.",
    distanciaKm: viaje.distancia_km,
    tiempoEstimadoHoras: viaje.tiempo_estimado_horas,
    gananciaConductorOficial: null,
    estadoEconomico: estadoEconomicoDeViaje(viaje)
  };
}

export function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(new Date(fecha));
}

export function formatearDiaCalendario(fecha: Date) {
  return formatearFecha(fecha.toISOString());
}

export function formatearDiaSelector(fecha: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(fecha);
}

export function claveDia(fecha: string | Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).formatToParts(fecha instanceof Date ? fecha : new Date(fecha));
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

export function formatearHora(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(new Date(fecha));
}

export function formatearDistancia(km: number | null) {
  if (km == null || !Number.isFinite(km)) return "Por confirmar";
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}

export function formatearDistanciaAproximadaAlOrigen(km: number | null) {
  if (km == null || !Number.isFinite(km)) return "Activa ubicación";
  return `Aproximadamente a ${formatearDistancia(km)} de ti`;
}

export function formatearDuracion(horas: number | null) {
  if (horas == null || !Number.isFinite(horas)) return "Por confirmar";
  const minutos = Math.max(1, Math.round(horas * 60));
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function distanciaKmEntre(a: Coordenadas, b: { lat: number | null; lng: number | null }) {
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

export function formatearActualizacion(fecha: Date | null) {
  if (!fecha) return "Sin actualizar";
  return new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).format(fecha);
}

function partesFechaMexico(fecha: string | Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONA_HORARIA_VIAJE
  }).formatToParts(fecha instanceof Date ? fecha : new Date(fecha));
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return {
    year: Number(valor.year),
    month: Number(valor.month),
    day: Number(valor.day)
  };
}

function fechaUtcMediodiaDesdePartes({ year, month, day }: { year: number; month: number; day: number }) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function inicioSemanaDomingo(fecha = new Date()) {
  const fechaMexico = fechaUtcMediodiaDesdePartes(partesFechaMexico(fecha));
  fechaMexico.setUTCDate(fechaMexico.getUTCDate() - fechaMexico.getUTCDay());
  return fechaMexico;
}

export function estaSemanaActual(fechaIso: string, referencia = new Date()) {
  const inicio = inicioSemanaDomingo(referencia);
  const fin = new Date(inicio);
  fin.setUTCDate(inicio.getUTCDate() + 7);
  const clave = claveDia(fechaIso);
  return clave >= claveDia(inicio) && clave < claveDia(fin);
}

export function diasSemanaActual(referencia = new Date()) {
  const inicio = inicioSemanaDomingo(referencia);
  return Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setUTCDate(inicio.getUTCDate() + i);
    return dia;
  });
}

export function mismoDia(a: string, b: Date) {
  return claveDia(a) === claveDia(b);
}

export function esHoy(fechaIso: string) {
  return claveDia(fechaIso) === claveDia(new Date());
}

export function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

export function normalizarVista(valor: string | null): VistaViajes {
  return VISTAS.some((vista) => vista.id === valor) ? (valor as VistaViajes) : "disponibles";
}

export function normalizarGrupo(valor: string | null): GrupoMisViajes {
  return GRUPOS_MIS_VIAJES.some((grupo) => grupo.id === valor) ? (valor as GrupoMisViajes) : "en-curso";
}

export function normalizarFecha(valor: string | null): FiltroFecha {
  return FILTROS_FECHA.some((fecha) => fecha.id === valor) ? (valor as FiltroFecha) : "todos";
}

export function clasificarMisViajes(viaje: PasaporteRow): GrupoMisViajes | null {
  if (!viaje.estado) return null;
  const estado = viaje.estado as EstadoTraslado;
  if (ESTADOS_FINALIZADOS.has(estado)) return null;
  if (ESTADOS_PROXIMOS.has(estado)) return "proximos";
  if (ESTADOS_POR_CERRAR.has(estado)) return "por-cerrar";
  return "en-curso";
}

export function filtrarPorFecha(viajes: PasaporteRow[], detalles: Record<string, DetalleOperativo>, filtro: FiltroFecha) {
  if (filtro === "todos") return viajes;
  return viajes.filter((viaje) => {
    const fecha = (viaje.traslado_id ? detalles[viaje.traslado_id] : null)?.fechaHora ?? detalleFallback(viaje).fechaHora;
    if (filtro === "hoy") return esHoy(fecha);
    return estaSemanaActual(fecha);
  });
}

export function filtrarPorEstado(viajes: PasaporteRow[], estado: string) {
  if (!estado || estado === "todos") return viajes;
  return viajes.filter((viaje) => viaje.estado === estado);
}

export function crearCalendario(
  disponibles: PasaporteRow[],
  aceptados: PasaporteRow[],
  detalles: Record<string, DetalleOperativo>,
  referencia = new Date()
) {
  const todos = [
    ...disponibles.map((viaje) => ({ viaje, tipo: "Ofertado" })),
    ...aceptados.map((viaje) => ({ viaje, tipo: GLOSARIO_OPERATIVO.aceptado }))
  ];
  return diasSemanaActual(referencia).map((dia) => ({
    dia,
    viajes: todos.filter(({ viaje }) => {
      const fecha = (viaje.traslado_id ? detalles[viaje.traslado_id] : null)?.fechaHora ?? detalleFallback(viaje).fechaHora;
      return mismoDia(fecha, dia);
    })
  }));
}
