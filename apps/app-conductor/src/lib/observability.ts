import type { Json } from "@ruum/shared/types";
import { crearClienteNavegador } from "./supabase-browser";

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

export type OperationalSeverity = "info" | "warning" | "error";

const FORBIDDEN = /curp|clabe|cuenta|tarjeta|token|signed|photo|foto|url/i;

function appVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "1.0.0";
}

function sanitize(input: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([k]) => !FORBIDDEN.test(k))
      .map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 240) : v])
  );
}

/**
 * P0.3 — Observabilidad producción.
 * - Versionado dinámico desde NEXT_PUBLIC_APP_VERSION (no hardcode).
 * - Sanitiza PII, añade ruta y severidad.
 * - No rompe operación si Supabase no está configurado.
 */
export async function recordOperationalEvent(
  type: OperationalEvent,
  details: Record<string, unknown> = {},
  severity: OperationalSeverity = "error"
) {
  try {
    const client = crearClienteNavegador();
    const ruta = typeof window !== "undefined" ? window.location.pathname.slice(0, 120) : undefined;
    await client.rpc("registrar_evento_operativo_app", {
      p_tipo: type,
      p_version_app: appVersion(),
      p_detalle: sanitize({ ...details, severity, ruta, timestamp: new Date().toISOString() }) as unknown as Json
    });
  } catch {
    /* observability must never break operation */
  }
  // Mirror a Sentry si está configurado (no-op si no existe DSN)
  try {
    const w = typeof window !== "undefined" ? (window as unknown as { Sentry?: { captureMessage: (msg: string, opts: unknown) => void } }) : null;
    if (w?.Sentry?.captureMessage) {
      w.Sentry.captureMessage(`[operational:${type}]`, { level: severity, extra: details });
    }
  } catch {
    /* ignore */
  }
}
