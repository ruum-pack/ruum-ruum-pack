import type { EstadoTraslado } from "@ruum/shared/types";

// Categorías visuales para los 32 estados del traslado (PRD §6). El PRD no
// define colores; esta es una decisión de UI razonable, agrupando estados
// por lo que el usuario necesita sentir/hacer en cada uno, no por su nombre técnico.
export type CategoriaEstado = "inicial" | "activo" | "atencion" | "completado" | "fallido";

export const CATEGORIA_POR_ESTADO: Record<EstadoTraslado, CategoriaEstado> = {
  usuario_pendiente_verificacion: "inicial",
  usuario_verificado: "completado",
  solicitud_creada: "inicial",
  documentacion_pendiente: "atencion",
  documentacion_en_revision: "atencion",
  documentacion_validada: "completado",
  cotizacion_generada: "completado",
  cotizacion_aceptada: "atencion",
  servicio_confirmado: "completado",
  pendiente_de_conductor: "atencion",
  conductor_asignado: "completado",
  conductor_en_camino_al_origen: "activo",
  conductor_en_punto_de_recoleccion: "activo",
  verificacion_vehiculo_en_proceso: "activo",
  evidencia_inicial_en_proceso: "activo",
  evidencia_inicial_completada: "completado",
  vehiculo_recibido: "completado",
  traslado_en_curso: "activo",
  incidencia_reportada: "atencion",
  llegada_a_destino: "activo",
  evidencia_final_en_proceso: "activo",
  evidencia_final_completada: "completado",
  entrega_confirmada: "completado",
  pago_pendiente: "atencion",
  pago_completado: "completado",
  servicio_cerrado: "completado",
  servicio_cancelado: "fallido",
  traslado_fallido: "fallido",
  dano_no_reportado_en_revision: "atencion",
  reclamo_abierto: "atencion",
  reclamo_resuelto: "completado",
  cierre_operativo_con_incidencia_abierta: "atencion",
  disputa_abierta: "atencion",
  disputa_resuelta: "completado"
};

export const ETIQUETA_CATEGORIA: Record<CategoriaEstado, string> = {
  inicial: "Por iniciar",
  activo: "En curso",
  atencion: "Requiere atención",
  completado: "Avanzando",
  fallido: "Detenido"
};
