/**
 * Fachada: la implementación vive en `@ruum/api/observability` (fuente única
 * para conductor y usuario). Sanitización reforzada (claves + valores) y
 * mirror Sentry con etiqueta `operational`.
 *
 * Nota: a diferencia de la versión anterior, no hay pre-check de sesión —
 * el RPC decide; si no hay sesión el error se captura en silencio igual que
 * antes. Ver `test/observability.test.ts`.
 */
import { crearRecordOperationalEvent, type OperationalSeverity } from "@ruum/api/observability";
import { crearClienteNavegador } from "./supabase-browser";

export type { OperationalSeverity };

export type OperationalEvent =
  | "startup_failure"
  | "permission_error"
  | "tracking_stopped"
  | "sync_failure"
  | "evidence_stuck"
  | "rpc_failure"
  | "session_expired"
  | "push_not_registered"
  | "native_crash"
  | "session_force_logout";

const record = crearRecordOperationalEvent({ etiquetaSentry: "operational", crearCliente: crearClienteNavegador });

export function recordOperationalEvent(
  type: OperationalEvent,
  details: Record<string, unknown> = {},
  severity: OperationalSeverity = "error"
): Promise<void> {
  return record(type, details, severity);
}
