import type { EstadoTraslado } from "../types/traslado";

/**
 * PRD §5.12 (revisado) — decisión resuelta en la sesión de revisión del
 * PRD: el chat está disponible desde que se asigna conductor hasta que se
 * concluye el traslado; después del cierre, toda comunicación pasa al área
 * de soporte. Esto reemplaza la versión de 12.4 que decía "24 horas
 * post-cierre" — esa contradicción ya quedó resuelta en el PRD revisado.
 *
 * 0013_comunicacion.sql (Fase 1) dejó la ventana exacta "pendiente de
 * validar en la capa de servicios" — esta función es esa validación.
 */
const ESTADOS_CON_CHAT_DISPONIBLE: ReadonlySet<EstadoTraslado> = new Set<EstadoTraslado>([
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
  "entrega_confirmada",
  "pago_pendiente",
  "pago_completado"
]);

export function chatDisponible(estado: EstadoTraslado): boolean {
  return ESTADOS_CON_CHAT_DISPONIBLE.has(estado);
}
