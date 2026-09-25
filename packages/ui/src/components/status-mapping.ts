export type EstadoVisualTraslado =
  | "solicitado"
  | "cotizacion-confirmada"
  | "pendiente-conductor"
  | "conductor-asignado"
  | "evidencia-inicial-completa"
  | "en-ruta"
  | "entrega-confirmada"
  | "cerrado"
  | "evidencia-pendiente"
  | "incidente-abierto"
  | "cancelado"
  | "pago-detenido";

/** Mapeo de los 34 estados técnicos → 12 estados visuales (el nombre/color/ícono es el mismo en app, panel, reporte y WhatsApp). */
export function estadoVisualDesdeTecnico(tecnico: string): EstadoVisualTraslado {
  switch (tecnico) {
    case "cotizacion_generada":
    case "cotizacion_aceptada":
    case "servicio_confirmado":
      return "cotizacion-confirmada";
    case "pendiente_de_conductor":
    case "documentacion_pendiente":
    case "documentacion_en_revision":
      return "pendiente-conductor";
    case "conductor_asignado":
    case "conductor_en_camino_al_origen":
    case "conductor_en_punto_de_recoleccion":
      return "conductor-asignado";
    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
    case "documentacion_validada":
      return "evidencia-inicial-completa";
    case "traslado_en_curso":
    case "llegada_a_destino":
    case "verificacion_vehiculo_en_proceso":
    case "evidencia_inicial_en_proceso":
      return "en-ruta";
    case "evidencia_final_completada":
    case "entrega_confirmada":
      return "entrega-confirmada";
    case "pago_completado":
    case "servicio_cerrado":
      return "cerrado";
    case "evidencia_final_en_proceso":
    case "pago_pendiente":
      return "evidencia-pendiente";
    case "incidencia_reportada":
    case "cierre_operativo_con_incidencia_abierta":
    case "reclamo_abierto":
    case "disputa_abierta":
    case "dano_no_reportado_en_revision":
      return "incidente-abierto";
    case "servicio_cancelado":
    case "traslado_fallido":
      return "cancelado";
    case "reclamo_resuelto":
    case "disputa_resuelta":
      return "cerrado";
    default:
      return "solicitado";
  }
}
