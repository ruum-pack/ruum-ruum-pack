/**
 * Ruum Ruum — Glosario Oficial de Microcopy y Términos para App Usuario
 *
 * Transforma jerga operativa interna en lenguaje claro, empático y centrado en la tranquilidad.
 */

export const TERMINOLOGIA_USUARIO: Record<string, string> = {
  // Estados y entidades operativas
  autoclasificacion: "clasificación automática",
  "Torre de Control": "nuestro equipo de operaciones",
  torre_de_control: "equipo de operaciones",
  solicitud_creada: "Solicitud recibida",
  documentacion_pendiente: "En preparación",
  documentacion_en_revision: "En preparación",
  documentacion_validada: "En preparación",
  cotizacion_generada: "En preparación",
  cotizacion_aceptada: "Pago pendiente",
  servicio_confirmado: "En preparación",
  pendiente_de_conductor: "Buscando conductor certificado",
  conductor_asignado: "Conductor asignado",
  conductor_en_camino_al_origen: "Conductor en camino a tu domicilio",
  conductor_en_punto_de_recoleccion: "Recolección en proceso",
  verificacion_vehiculo_en_proceso: "Verificación y evidencia inicial",
  evidencia_inicial_en_proceso: "Fotografiando estado inicial",
  evidencia_inicial_completada: "Evidencia inicial registrada",
  vehiculo_recibido: "Vehículo recibido y verificado",
  traslado_en_curso: "En camino a destino",
  incidencia_reportada: "Incidente en atención",
  llegada_a_destino: "Vehículo en punto de entrega",
  evidencia_final_en_proceso: "Fotografiando estado final",
  evidencia_final_completada: "Evidencia final registrada",
  entrega_confirmada: "Vehículo entregado con éxito",
  pago_pendiente: "Pendiente de pago",
  pago_completado: "Pago confirmado",
  servicio_cerrado: "Viaje finalizado",
  servicio_cancelado: "Cancelado",
  traslado_fallido: "Traslado no completado",
  cierre_operativo_con_incidencia_abierta: "Finalizado con reporte"
};

/**
 * Traduce términos técnicos y mensajes internos a lenguaje comprensible para el usuario.
 */
export function normalizarTerminoUsuario(texto: string | null | undefined): string {
  if (!texto) return "";
  let resultado = texto;
  for (const [clave, reemplazo] of Object.entries(TERMINOLOGIA_USUARIO)) {
    resultado = resultado.replaceAll(clave, reemplazo);
  }
  return resultado;
}

/**
 * Ayudas contextuales para campos densos del formulario y vistas de usuario.
 */
export const AYUDAS_CAMPOS = {
  vin: "El VIN o número de serie tiene 17 caracteres alfanuméricos. Puedes consultarlo en tu tarjeta de circulación o en la esquina inferior del parabrisas.",
  placas: "Formato oficial de placas (ej. ABC-123-A). Si es auto nuevo sin placas, escribe 'PERMISO'.",
  transmision: "Selecciona si el vehículo es estándar (manual), automático o 100% eléctrico.",
  condicion: "Elige 'Nueva' si sale de agencia, 'Seminueva' si es particular/usado, o 'Rescate mecánico' si requiere asistencia especializada.",
  agenda: "Programamos con zona horaria America/Mexico_City (Centro de México). Anticipación mínima de 2 horas para asignar al mejor conductor.",
  evidencia: "Capturamos fotos obligatorias de frente, ambos lados, odómetro y detalles antes de encender el motor y al momento de la entrega.",
  tarifa: "Tarifa fija y transparente calculada por distancia, tipo de vehículo y condiciones de la ruta. Sin costos ocultos.",
  seguro: "Cada traslado cuenta con cobertura de póliza de responsabilidad civil y daños en tránsito gestionada por aseguradora autorizada."
} as const;
