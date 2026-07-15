/**
 * Lógica pura del webhook de Stripe — sin llamadas a red ni a Postgres, así
 * se puede probar con `deno test` igual que packages/shared/src/rules (sin
 * necesitar mockear el cliente de Supabase para la parte que de verdad
 * decide algo).
 */

/**
 * Idempotencia ante reintentos de Stripe: si Stripe no recibe 200 a tiempo,
 * reintenta el mismo evento. Sin este chequeo, un PaymentIntent exitoso
 * podría procesarse dos veces.
 */
export function esEventoYaProcesado(eventoIdActual: string, eventoIdGuardado: string | null | undefined): boolean {
  return eventoIdGuardado === eventoIdActual;
}

/**
 * PRD §4.6 — el cobro al usuario debe poder rastrearse hasta el traslado
 * exacto. Sin traslado_id en metadata, no hay a qué fila de `pagos`
 * aplicarle el resultado — se descarta el evento explícitamente en vez de
 * adivinar.
 */
export function extraerTrasladoId(metadata: Record<string, string> | null | undefined): string | null {
  return metadata?.traslado_id ?? null;
}

export type TipoEventoManejado =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed";

const EVENTOS_MANEJADOS: readonly TipoEventoManejado[] = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed"
];

export function esEventoManejado(tipo: string): tipo is TipoEventoManejado {
  return (EVENTOS_MANEJADOS as readonly string[]).includes(tipo);
}

export function estadoTrasladoSiguienteTrasPago(
  estadoActual: string | null | undefined,
  tipoPago: string | null | undefined,
  estadoPago: "pendiente" | "completado" | "reembolsado" | "fallido"
): string | null {
  if (estadoPago !== "completado") return null;
  if (tipoPago !== "anticipado" && tipoPago !== "al_cierre") return null;

  if (estadoActual === "cotizacion_aceptada" && tipoPago === "anticipado") {
    return "servicio_confirmado";
  }

  if (estadoActual === "entrega_confirmada" || estadoActual === "pago_pendiente") {
    return "pago_completado";
  }

  return null;
}
