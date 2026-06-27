// PRD §16 — eventos auditables. Cada evento debe registrar timestamp, actor,
// acción, datos relevantes e IP/dispositivo si aplica.
export type ActorAuditoria = "usuario" | "conductor" | "admin" | "sistema";

export type EventoAuditable =
  | "creacion_cuenta"
  | "verificacion_cuenta"
  | "carga_documentos"
  | "validacion_documentos"
  | "creacion_solicitud_traslado"
  | "generacion_cotizacion"
  | "confirmacion_servicio"
  | "asignacion_conductor"
  | "aceptacion_traslado_conductor"
  | "llegada_conductor_origen"
  | "captura_evidencia_inicial"
  | "confirmacion_vehiculo_recibido"
  | "inicio_traslado"
  | "reporte_incidencia"
  | "llegada_destino"
  | "captura_evidencia_final"
  | "confirmacion_entrega"
  | "registro_pago"
  | "cierre_traslado"
  | "cancelacion_traslado"
  | "apertura_disputa"
  | "resolucion_disputa"
  | "apertura_reclamo_seguro"
  | "resolucion_reclamo_seguro"
  | "suspension_conductor"
  | "modificacion_traslado_activo"
  | "activacion_soporte_emergencia"
  | "comunicacion_usuario_conductor"
  | "calificacion_conductor"
  | "exportacion_pasaporte_pdf"
  | "asignacion_modo_prueba_supervisada"
  | "resultado_modo_prueba_supervisada";

export interface RegistroAuditoria {
  id: string;
  traslado_id?: string;
  evento: EventoAuditable;
  actor: ActorAuditoria;
  actor_id: string;
  datos: Record<string, unknown>;
  ip?: string;
  dispositivo?: string;
  timestamp: string;
}
