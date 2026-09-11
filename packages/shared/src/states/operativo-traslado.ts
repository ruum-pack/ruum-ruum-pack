import type { EstadoTraslado } from "../types/traslado";

// FASE 3 — Estado operativo único derivado del legacy.
// Espejo de public.traducir_estado_operativo() en
// supabase/migrations/20260908000003_ciclo_vida_operativo.sql (la DB manda;
// este mapa existe para que apps/panel/reportes/notificaciones no ramifiquen
// sobre estados legacy de pago/reclamo/disputa).

export type EstadoOperativoTraslado =
  | "draft"
  | "requested"
  | "confirmed"
  | "planned"
  | "assigned"
  | "pickup_in_progress"
  | "vehicle_received"
  | "in_transit"
  | "delivery_in_progress"
  | "delivered"
  | "closed"
  | "cancelled"
  | "failed";

export type DominioTraslado =
  | "Transfer"
  | "Assignment"
  | "Billing"
  | "Claim"
  | "Dispute"
  | "Documentation";

export const ESTADOS_OPERATIVOS: EstadoOperativoTraslado[] = [
  "draft",
  "requested",
  "confirmed",
  "planned",
  "assigned",
  "pickup_in_progress",
  "vehicle_received",
  "in_transit",
  "delivery_in_progress",
  "delivered",
  "closed",
  "cancelled",
  "failed"
];

export const LEGACY_A_OPERATIVO: Record<EstadoTraslado, EstadoOperativoTraslado> = {
  usuario_pendiente_verificacion: "requested",
  usuario_verificado: "requested",
  solicitud_creada: "requested",
  documentacion_pendiente: "requested",
  documentacion_en_revision: "requested",
  documentacion_validada: "requested",
  cotizacion_generada: "requested",
  cotizacion_aceptada: "requested",
  servicio_confirmado: "confirmed",
  pendiente_de_conductor: "planned",
  conductor_asignado: "assigned",
  conductor_en_camino_al_origen: "assigned",
  conductor_en_punto_de_recoleccion: "assigned",
  verificacion_vehiculo_en_proceso: "pickup_in_progress",
  evidencia_inicial_en_proceso: "pickup_in_progress",
  evidencia_inicial_completada: "pickup_in_progress",
  vehiculo_recibido: "vehicle_received",
  traslado_en_curso: "in_transit",
  incidencia_reportada: "in_transit",
  llegada_a_destino: "delivery_in_progress",
  evidencia_final_en_proceso: "delivery_in_progress",
  evidencia_final_completada: "delivery_in_progress",
  entrega_confirmada: "delivered",
  pago_pendiente: "closed",
  pago_completado: "closed",
  servicio_cerrado: "closed",
  servicio_cancelado: "cancelled",
  traslado_fallido: "failed",
  dano_no_reportado_en_revision: "closed",
  reclamo_abierto: "closed",
  reclamo_resuelto: "closed",
  cierre_operativo_con_incidencia_abierta: "closed",
  disputa_abierta: "closed",
  disputa_resuelta: "closed"
};

export const DOMINIO_POR_ESTADO: Record<EstadoTraslado, DominioTraslado> = {
  usuario_pendiente_verificacion: "Transfer",
  usuario_verificado: "Transfer",
  solicitud_creada: "Transfer",
  documentacion_pendiente: "Documentation",
  documentacion_en_revision: "Documentation",
  documentacion_validada: "Documentation",
  cotizacion_generada: "Documentation",
  cotizacion_aceptada: "Documentation",
  servicio_confirmado: "Transfer",
  pendiente_de_conductor: "Assignment",
  conductor_asignado: "Assignment",
  conductor_en_camino_al_origen: "Assignment",
  conductor_en_punto_de_recoleccion: "Assignment",
  verificacion_vehiculo_en_proceso: "Transfer",
  evidencia_inicial_en_proceso: "Transfer",
  evidencia_inicial_completada: "Transfer",
  vehiculo_recibido: "Transfer",
  traslado_en_curso: "Transfer",
  incidencia_reportada: "Transfer",
  llegada_a_destino: "Transfer",
  evidencia_final_en_proceso: "Transfer",
  evidencia_final_completada: "Transfer",
  entrega_confirmada: "Transfer",
  pago_pendiente: "Billing",
  pago_completado: "Billing",
  servicio_cerrado: "Transfer",
  servicio_cancelado: "Transfer",
  traslado_fallido: "Transfer",
  dano_no_reportado_en_revision: "Claim",
  reclamo_abierto: "Claim",
  reclamo_resuelto: "Claim",
  cierre_operativo_con_incidencia_abierta: "Claim",
  disputa_abierta: "Dispute",
  disputa_resuelta: "Dispute"
};

const OPERATIVOS_TERMINALES: EstadoOperativoTraslado[] = ["closed", "cancelled", "failed"];

export function mapearEstadoOperativo(estado: EstadoTraslado): EstadoOperativoTraslado {
  return LEGACY_A_OPERATIVO[estado];
}

export function dominioDeEstado(estado: EstadoTraslado): DominioTraslado {
  return DOMINIO_POR_ESTADO[estado];
}

/**
 * Criterio de salida Fase 3: para saber si un vehículo está viajando ya no
 * hace falta conocer pago_pendiente / reclamo_abierto / disputa_resuelta.
 */
export function estaViajando(estado: EstadoTraslado | EstadoOperativoTraslado): boolean {
  const operativo = (ESTADOS_OPERATIVOS as readonly string[]).includes(estado)
    ? (estado as EstadoOperativoTraslado)
    : mapearEstadoOperativo(estado as EstadoTraslado);
  return operativo === "in_transit";
}

export function esOperativoTerminal(operativo: EstadoOperativoTraslado): boolean {
  return OPERATIVOS_TERMINALES.includes(operativo);
}

/** Compatibilidad: un solo punto de entrada para apps/panel/reportes/notificaciones. */
export const LegacyTransferStateMapper = {
  toOperativo: mapearEstadoOperativo,
  dominio: dominioDeEstado,
  estaViajando,
  esTerminal: esOperativoTerminal,
  legacyAOperativo: LEGACY_A_OPERATIVO,
  dominioPorEstado: DOMINIO_POR_ESTADO
};
