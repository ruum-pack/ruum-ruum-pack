import type { Database } from "@ruum/shared/types";
import { getTripPresentation } from "../../lib/trip-presentation";
import type { ContactRole } from "../viajes/[id]/ContactActionBar";

export type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
export type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];
export type PanelReviewState = {
  conductorId?: string;
  solicitudId?: string;
  nombre: string;
  documentos: DocumentoConductorRow[];
  estado: Database["public"]["Enums"]["estado_expediente_conductor"];
  enviadoEn?: string | null;
};

export function nombreVehiculo(viaje: PasaporteRow) {
  return [viaje.vehiculo_marca, viaje.vehiculo_modelo, viaje.vehiculo_anio].filter(Boolean).join(" ") || "Vehículo";
}

export function folioViaje(viaje: PasaporteRow) {
  return viaje.traslado_id.slice(0, 8).toUpperCase();
}

export function destinoOperativo(viaje: PasaporteRow) {
  const presentation = getTripPresentation(viaje.estado);
  if (presentation.requiresControlTowerDecision || presentation.primaryAction.action === "contact_support") {
    return "Torre de Control dará indicaciones";
  }

  const vaADestino = usaDestinoActual(presentation.primaryAction.action);
  const direccion = vaADestino ? viaje.destino_direccion : viaje.origen_direccion;
  const ciudad = vaADestino ? viaje.destino_ciudad : viaje.origen_ciudad;

  if (direccion && ciudad) return `${direccion} · ${ciudad}`;
  if (direccion) return direccion;
  if (ciudad) return ciudad;
  return vaADestino ? "Punto de entrega" : "Punto de recolección";
}

export function usaDestinoActual(action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  return ["go_destination", "mark_arrived_destination", "capture_destination_record", "confirm_delivery", "close_trip"].includes(action);
}

export function puntoActual(viaje: PasaporteRow, action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  if (["contact_support", "review_status", "view_available_trips", "none"].includes(action)) {
    return {
      lat: null,
      lng: null,
      etiqueta: "Seguimiento operativo"
    };
  }

  const destino = usaDestinoActual(action);
  return {
    lat: destino ? viaje.destino_lat : viaje.origen_lat,
    lng: destino ? viaje.destino_lng : viaje.origen_lng,
    etiqueta: destino ? "Punto de entrega" : "Punto de recolección"
  };
}

export function contactoRelevante(viaje: PasaporteRow, action: ReturnType<typeof getTripPresentation>["primaryAction"]["action"]) {
  if (["contact_support", "review_status", "view_available_trips", "none"].includes(action)) {
    return {
      role: "soporte" as ContactRole,
      name: "Equipo de soporte",
      phone: null
    };
  }

  const destino = usaDestinoActual(action);
  return {
    role: destino ? ("destino" as ContactRole) : ("origen" as ContactRole),
    name: destino ? viaje.contacto_recepcion_nombre : viaje.contacto_entrega_nombre,
    phone: destino ? viaje.contacto_recepcion_telefono : viaje.contacto_entrega_telefono
  };
}

export function fechaViaje(viaje: PasaporteRow) {
  const fecha = viaje.creado_en ?? viaje.actualizado_en;
  if (!fecha) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City"
  }).format(new Date(fecha));
}

export function esViajePorCerrar(viaje: PasaporteRow) {
  return ["llegada_a_destino", "evidencia_final_en_proceso", "evidencia_final_completada", "entrega_confirmada"].includes(viaje.estado);
}
