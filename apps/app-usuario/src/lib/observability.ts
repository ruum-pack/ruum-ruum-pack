/**
 * P1 Observabilidad App Usuario
 *
 * Fachada: la implementación vive en `@ruum/api/observability` (fuente única
 * para conductor y usuario). Eventos y severidades propios de usuario; el
 * contrato (sanitizeDetails, firma de recordOperationalEvent, etiqueta
 * Sentry `usuario`) se conserva intacto — ver `test/observability-usuario.test.ts`.
 */
import {
  crearRecordOperationalEvent,
  sanitizeDetails,
  type OperationalSeverity
} from "@ruum/api/observability";
import { crearClienteNavegador } from "./supabase-browser";

export { sanitizeDetails };
export type { OperationalSeverity };

export type UsuarioOperationalEvent =
  | "login_failure"
  | "login_success"
  | "auth_callback_error"
  | "auth_callback_success"
  | "recovery_failure"
  | "recovery_success"
  | "quote_calculation_failure"
  | "quote_calculation_success"
  | "geocoding_failure"
  | "geocoding_success"
  | "stripe_payment_failure"
  | "stripe_payment_success"
  | "trip_creation_failure"
  | "trip_creation_success"
  | "supabase_error"
  | "startup_failure";

const record = crearRecordOperationalEvent({ etiquetaSentry: "usuario", crearCliente: crearClienteNavegador });

export function recordOperationalEvent(
  type: UsuarioOperationalEvent,
  details: Record<string, unknown> = {},
  severity: OperationalSeverity = "error"
): Promise<void> {
  return record(type, details, severity);
}
