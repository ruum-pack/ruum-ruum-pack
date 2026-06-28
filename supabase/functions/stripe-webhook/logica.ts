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

/**
 * PRD §4.6 — onboarding de Stripe Connect (Express) para el conductor.
 * Stripe considera la cuenta operativa cuando ambos flags son true; antes
 * de eso, sigue en revisión/onboarding sin importar cuántos webhooks
 * intermedios lleguen.
 */
export function cuentaConductorEstaActiva(chargesEnabled: boolean | undefined, detailsSubmitted: boolean | undefined): boolean {
  return Boolean(chargesEnabled && detailsSubmitted);
}

export type TipoEventoManejado =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "account.updated"
  | "transfer.created"
  | "transfer.reversed";

const EVENTOS_MANEJADOS: readonly TipoEventoManejado[] = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "account.updated",
  "transfer.created",
  "transfer.reversed"
];

export function esEventoManejado(tipo: string): tipo is TipoEventoManejado {
  return (EVENTOS_MANEJADOS as readonly string[]).includes(tipo);
}
