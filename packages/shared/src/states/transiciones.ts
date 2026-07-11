import type { EstadoTraslado } from "../types/traslado";

/**
 * PRD §6 — "Diagrama de transiciones de estados". Mapa de transiciones
 * válidas: estado actual -> estados a los que puede pasar.
 *
 * Reglas generales del diagrama del PRD, aplicadas estado por estado:
 * - El flujo exitoso lineal (Solicitud creada -> ... -> Servicio cerrado).
 * - "Cualquier estado activo -> Incidencia reportada -> (vuelve al estado
 *   anterior o Traslado fallido)".
 * - "Cualquier estado previo a Vehículo recibido -> Servicio cancelado".
 * - "Cualquier estado -> Traslado fallido (si incidencia impide continuidad)".
 * - "Servicio cerrado -> Daño no reportado en revisión -> Reclamo abierto -> Reclamo resuelto".
 * - "Cualquier estado post-cierre -> Disputa abierta -> Disputa resuelta".
 */
export const TRANSICIONES: Record<EstadoTraslado, EstadoTraslado[]> = {
  usuario_pendiente_verificacion: ["usuario_verificado"],
  usuario_verificado: ["solicitud_creada"],
  solicitud_creada: ["documentacion_pendiente", "servicio_cancelado"],
  documentacion_pendiente: ["documentacion_en_revision", "servicio_cancelado"],
  documentacion_en_revision: ["documentacion_validada", "documentacion_pendiente", "servicio_cancelado"],
  documentacion_validada: ["cotizacion_generada"],
  cotizacion_generada: ["cotizacion_aceptada", "servicio_confirmado", "servicio_cancelado"],
  cotizacion_aceptada: ["servicio_confirmado", "servicio_cancelado"],
  servicio_confirmado: ["pendiente_de_conductor", "servicio_cancelado"],
  pendiente_de_conductor: ["conductor_asignado", "servicio_cancelado"],
  conductor_asignado: ["conductor_en_camino_al_origen", "servicio_cancelado", "traslado_fallido"],
  conductor_en_camino_al_origen: ["conductor_en_punto_de_recoleccion", "incidencia_reportada"],
  conductor_en_punto_de_recoleccion: [
    "verificacion_vehiculo_en_proceso",
    "incidencia_reportada",
    "traslado_fallido",
    "servicio_cancelado"
  ],
  verificacion_vehiculo_en_proceso: ["evidencia_inicial_en_proceso", "traslado_fallido"],
  evidencia_inicial_en_proceso: ["evidencia_inicial_completada"],
  evidencia_inicial_completada: ["vehiculo_recibido"],
  vehiculo_recibido: ["traslado_en_curso"],
  traslado_en_curso: ["llegada_a_destino", "incidencia_reportada"],
  incidencia_reportada: ["traslado_en_curso", "traslado_fallido", "llegada_a_destino"],
  llegada_a_destino: ["evidencia_final_en_proceso"],
  evidencia_final_en_proceso: ["evidencia_final_completada"],
  evidencia_final_completada: ["entrega_confirmada"],
  entrega_confirmada: ["pago_pendiente", "pago_completado"],
  pago_pendiente: ["pago_completado"],
  pago_completado: ["servicio_cerrado"],
  servicio_cerrado: ["dano_no_reportado_en_revision", "disputa_abierta"],
  dano_no_reportado_en_revision: ["reclamo_abierto", "cierre_operativo_con_incidencia_abierta"],
  reclamo_abierto: ["reclamo_resuelto"],
  // PRD: "Cualquier estado post-cierre -> Disputa abierta" — un reclamo
  // resuelto sigue siendo post-cierre, por lo que una disputa aún puede abrirse.
  reclamo_resuelto: ["disputa_abierta"],
  cierre_operativo_con_incidencia_abierta: ["reclamo_resuelto", "disputa_abierta", "disputa_resuelta"],
  disputa_abierta: ["disputa_resuelta"],
  disputa_resuelta: [],
  servicio_cancelado: [],
  traslado_fallido: []
};

export function transicionValida(actual: EstadoTraslado, siguiente: EstadoTraslado): boolean {
  return TRANSICIONES[actual]?.includes(siguiente) ?? false;
}

// PRD §6 — "Cualquier estado previo a Vehículo recibido -> Servicio cancelado"
const ESTADOS_PREVIOS_A_VEHICULO_RECIBIDO: EstadoTraslado[] = [
  "usuario_pendiente_verificacion",
  "usuario_verificado",
  "solicitud_creada",
  "documentacion_pendiente",
  "documentacion_en_revision",
  "documentacion_validada",
  "cotizacion_generada",
  "cotizacion_aceptada",
  "servicio_confirmado",
  "pendiente_de_conductor",
  "conductor_asignado",
  "conductor_en_camino_al_origen",
  "conductor_en_punto_de_recoleccion",
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_inicial_completada"
];

export function puedeCancelarse(estado: EstadoTraslado): boolean {
  return ESTADOS_PREVIOS_A_VEHICULO_RECIBIDO.includes(estado);
}

// PRD §6 — "Cualquier estado post-cierre -> Disputa abierta -> Disputa resuelta"
const ESTADOS_POST_CIERRE: EstadoTraslado[] = [
  "servicio_cerrado",
  "dano_no_reportado_en_revision",
  "reclamo_abierto",
  "reclamo_resuelto",
  "cierre_operativo_con_incidencia_abierta"
];

export function puedeAbrirDisputa(estado: EstadoTraslado): boolean {
  return ESTADOS_POST_CIERRE.includes(estado);
}
