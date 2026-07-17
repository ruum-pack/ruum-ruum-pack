import type { Database } from "@ruum/shared/types";
import { ESTADOS_TRASLADO } from "@ruum/shared/states";
import { getTripPresentation } from "../lib/trip-presentation";

export type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
export type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export type ViajeActivo = {
  trasladoId: string;
  estado: EstadoTraslado;
  folio: string;
  etapa: string;
  destinoActual: string;
};

export type RegistroViajeActivoInput = Partial<ViajeActivo> & {
  trasladoId: string;
  estado: EstadoTraslado;
  origenDireccion?: string | null;
  origenCiudad?: string | null;
  destinoDireccion?: string | null;
  destinoCiudad?: string | null;
};

const INDICE_INICIO_EMERGENCIA = ESTADOS_TRASLADO.indexOf("conductor_asignado");
const INDICE_FIN_EMERGENCIA = ESTADOS_TRASLADO.indexOf("evidencia_final_completada");

const ESTADOS_OPERACION_ACTIVA: EstadoTraslado[] = [
  "conductor_asignado",
  "conductor_en_camino_al_origen",
  "conductor_en_punto_de_recoleccion",
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_inicial_completada",
  "vehiculo_recibido",
  "traslado_en_curso",
  "incidencia_reportada",
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada"
];

const ESTADOS_SEGUIMIENTO_UBICACION: EstadoTraslado[] = [
  "conductor_en_camino_al_origen",
  "conductor_en_punto_de_recoleccion",
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_inicial_completada",
  "vehiculo_recibido",
  "traslado_en_curso",
  "incidencia_reportada",
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada"
];

export function viajePermiteEmergencia(estado: EstadoTraslado) {
  const indice = ESTADOS_TRASLADO.indexOf(estado);
  return indice >= INDICE_INICIO_EMERGENCIA && indice <= INDICE_FIN_EMERGENCIA;
}

export function viajePermiteSeguimientoUbicacion(estado: EstadoTraslado) {
  return ESTADOS_SEGUIMIENTO_UBICACION.includes(estado);
}

export function viajeEsOperacionActiva(estado: EstadoTraslado) {
  return ESTADOS_OPERACION_ACTIVA.includes(estado);
}

function folioDesdeId(trasladoId: string) {
  return trasladoId.slice(0, 8).toUpperCase();
}

function direccionActualDeViaje(viaje: RegistroViajeActivoInput) {
  const presentation = getTripPresentation(viaje.estado);
  if (presentation.requiresControlTowerDecision || presentation.primaryAction.action === "contact_support") {
    return "Torre de Control dará indicaciones";
  }

  const usaDestino = ["go_destination", "mark_arrived_destination", "capture_destination_record", "confirm_delivery", "close_trip"].includes(
    presentation.primaryAction.action
  );
  const direccion = usaDestino ? viaje.destinoDireccion : viaje.origenDireccion;
  const ciudad = usaDestino ? viaje.destinoCiudad : viaje.origenCiudad;

  if (direccion && ciudad) return `${direccion} · ${ciudad}`;
  if (direccion) return direccion;
  if (ciudad) return ciudad;
  return usaDestino ? "Punto de entrega" : "Punto de recolección";
}

export function normalizarViajeActivo(viaje: RegistroViajeActivoInput, previo?: ViajeActivo | null): ViajeActivo | null {
  if (!viajeEsOperacionActiva(viaje.estado)) return null;

  const presentation = getTripPresentation(viaje.estado);
  return {
    trasladoId: viaje.trasladoId,
    estado: viaje.estado,
    folio: viaje.folio ?? previo?.folio ?? folioDesdeId(viaje.trasladoId),
    etapa: viaje.etapa ?? presentation.title,
    destinoActual: viaje.destinoActual ?? previo?.destinoActual ?? direccionActualDeViaje(viaje)
  };
}

export function viajeActivoDesdePasaporte(viaje: PasaporteRow): ViajeActivo | null {
  return normalizarViajeActivo({
    trasladoId: viaje.traslado_id,
    estado: viaje.estado,
    origenDireccion: viaje.origen_direccion,
    origenCiudad: viaje.origen_ciudad,
    destinoDireccion: viaje.destino_direccion,
    destinoCiudad: viaje.destino_ciudad
  });
}
