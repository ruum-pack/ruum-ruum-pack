import type { Json } from "@ruum/shared/types";
import { crearClienteNavegador } from "./supabase-browser";

/**
 * P1 Observabilidad App Usuario
 * Eventos prioritarios:
 * - login
 * - callback Auth
 * - recuperación
 * - cotización
 * - geocodificación
 * - Stripe (Elements / Payment Intents)
 * - creación de traslado
 * - errores Supabase
 *
 * Regla de seguridad estricta: NUNCA enviar passwords, tokens, JWT, service roles,
 * documentos, números de tarjeta ni PII innecesaria.
 */

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

export type OperationalSeverity = "info" | "warning" | "error";

const FORBIDDEN_KEYS = /password|token|jwt|service_role|secret|curp|clabe|cuenta|tarjeta|cvv|documento|foto|url_firmada|auth_header|bearer/i;
const SENSITIVE_VALUES_PATTERN = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}|bearer\s+[a-zA-Z0-9_\-\.]+|sk_(?:live|test)_[a-zA-Z0-9]+/i;

function appVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "1.0.0";
}

export function sanitizeDetails(input: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([k]) => !FORBIDDEN_KEYS.test(k))
      .map(([k, v]) => {
        if (typeof v === "string") {
          if (SENSITIVE_VALUES_PATTERN.test(v)) {
            return [k, "[REDACTED_SECRET]"];
          }
          return [k, v.slice(0, 240)];
        }
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          return [k, sanitizeDetails(v as Record<string, unknown>)];
        }
        return [k, v];
      })
  );
}

export async function recordOperationalEvent(
  type: UsuarioOperationalEvent,
  details: Record<string, unknown> = {},
  severity: OperationalSeverity = "error"
) {
  const sanitized = sanitizeDetails({
    ...details,
    severity,
    ruta: typeof window !== "undefined" && typeof window.location?.pathname === "string"
      ? window.location.pathname.slice(0, 120)
      : undefined,
    timestamp: new Date().toISOString()
  });

  try {
    const client = crearClienteNavegador();
    await client.rpc("registrar_evento_operativo_app", {
      p_tipo: type,
      p_version_app: appVersion(),
      p_detalle: sanitized as unknown as Json
    });
  } catch {
    /* observability must never break operation */
  }

  // Mirror seguro a Sentry si está disponible en cliente
  try {
    const w = typeof window !== "undefined" ? (window as unknown as { Sentry?: { captureMessage: (msg: string, opts: unknown) => void; captureException: (err: unknown, opts: unknown) => void } }) : null;
    if (w?.Sentry?.captureMessage) {
      w.Sentry.captureMessage(`[usuario:${type}]`, {
        level: severity,
        extra: sanitized
      });
    }
  } catch {
    /* ignore */
  }
}
