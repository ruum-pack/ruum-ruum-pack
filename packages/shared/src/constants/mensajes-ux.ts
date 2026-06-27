// PRD §4.7 — mensaje OBLIGATORIO antes de confirmar cancelación.
// El %s se sustituye por el porcentaje de cargo calculado en rules/politica-cancelacion.ts
export const MENSAJE_OBLIGATORIO_CANCELACION = (porcentaje: number): string =>
  `Cancelar ahora genera un cargo del ${porcentaje}%. ¿Deseas continuar?`;

// PRD §4.15 — mensaje obligatorio mientras la evidencia offline se sincroniza
export const MENSAJE_EVIDENCIA_SINCRONIZANDO = "Evidencia en proceso de sincronización";

// PRD §12 — mensajes clave sugeridos por momento del flujo (no obligatorios,
// salvo los dos anteriores; estos son guía de copy para las apps)
export const MENSAJES_CLAVE_UX: Record<string, string> = {
  antes_de_confirmar_traslado:
    "El vehículo debe estar en condiciones de circular. Ruum Ruum no realiza arrastres como parte del servicio estándar.",
  evidencia_inicial:
    "La evidencia inicial documenta el estado visible del vehículo antes del traslado. Puedes consultarla en tiempo real dentro del Pasaporte Digital.",
  cancelacion: "Cancelar ahora puede generar un cargo según el avance operativo del servicio.",
  pago: "Ruum Ruum solo acepta métodos electrónicos. No se permite pago en efectivo.",
  cierre: "Tu Pasaporte Digital de Traslado ya está completo y disponible para consulta. Puedes exportarlo a PDF.",
  calificacion: "¿Cómo fue tu experiencia con el conductor? Tu calificación nos ayuda a mantener la calidad del servicio.",
  disputa:
    "Si tienes alguna inconformidad con el cobro, daño o cualquier aspecto del traslado, puedes abrir una disputa. La resolveremos en un máximo de 5 días hábiles."
};
