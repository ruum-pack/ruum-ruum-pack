// PRD §6 — Estados del traslado (28 estados)
export type EstadoTraslado =
  | "usuario_pendiente_verificacion"
  | "usuario_verificado"
  | "solicitud_creada"
  | "documentacion_pendiente"
  | "documentacion_en_revision"
  | "documentacion_validada"
  | "cotizacion_generada"
  | "cotizacion_aceptada"
  | "servicio_confirmado"
  | "pendiente_de_conductor"
  | "conductor_asignado"
  | "conductor_en_camino_al_origen"
  | "conductor_en_punto_de_recoleccion"
  | "verificacion_vehiculo_en_proceso"
  | "evidencia_inicial_en_proceso"
  | "evidencia_inicial_completada"
  | "vehiculo_recibido"
  | "traslado_en_curso"
  | "incidencia_reportada"
  | "llegada_a_destino"
  | "evidencia_final_en_proceso"
  | "evidencia_final_completada"
  | "entrega_confirmada"
  | "pago_pendiente"
  | "pago_completado"
  | "servicio_cerrado"
  | "servicio_cancelado"
  | "traslado_fallido"
  | "dano_no_reportado_en_revision"
  | "reclamo_abierto"
  | "reclamo_resuelto"
  | "cierre_operativo_con_incidencia_abierta"
  | "disputa_abierta"
  | "disputa_resuelta";

// PRD §4.11 — clasificación de traslado fallido
export type CausaFallido =
  | "imputable_cliente"
  | "operativo"
  | "fuerza_mayor"
  | "documentacion"
  | "vehiculo_no_circulable";

// PRD §4.6 — momento de cobro
export type TipoPago = "anticipado" | "al_cierre";

export interface Coordenada {
  lat: number;
  lng: number;
  direccion: string;
  ciudad: string;
}

// PRD §4.1 — todo traslado debe tener nombre y teléfono de quien entrega/recibe
export interface Contacto {
  nombre: string;
  telefono: string;
}

export interface Traslado {
  id: string;
  estado: EstadoTraslado;
  usuario_id: string;
  vehiculo_id: string;
  conductor_id?: string;
  origen: Coordenada;
  destino: Coordenada;
  contacto_entrega: Contacto;
  contacto_recepcion: Contacto;
  precio_cotizado?: number;
  precio_final?: number;
  tipo_pago: TipoPago;
  causa_fallido?: CausaFallido;
  // PRD §4.4 — incidencia de daño no reportado se abre automáticamente
  tiene_incidencia_abierta: boolean;
  creado_en: string;
  actualizado_en: string;
}
