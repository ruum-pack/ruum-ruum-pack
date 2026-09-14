import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarEventoOperativoApp } from "../operations";

export type OperationalSeverity = "info" | "warning" | "error";

export type CrearClienteNavegador = () => SupabaseClient<Database>;

const FORBIDDEN_KEYS =
  /password|token|jwt|service_role|secret|curp|clabe|cuenta|tarjeta|cvv|documento|foto|url_firmada|auth_header|bearer/i;
const SENSITIVE_VALUES_PATTERN =
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}|bearer\s+[a-zA-Z0-9_\-.]+|sk_(?:live|test)_[a-zA-Z0-9]+/i;

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

/**
 * Observabilidad producción (nunca rompe la operación).
 * - Sanitiza PII/secretos (claves + valores), añade ruta y severidad.
 * - Versionado dinámico desde NEXT_PUBLIC_APP_VERSION (no hardcode).
 * - Mirror a `window.Sentry.captureMessage` si el host lo expone.
 */
export function crearRecordOperationalEvent({
  etiquetaSentry,
  crearCliente
}: {
  etiquetaSentry: string;
  /** Se inyecta desde la app para que los mocks de tests (`lib/supabase-browser`) sigan funcionando. */
  crearCliente: CrearClienteNavegador;
}) {
  return async function recordOperationalEvent(
    tipo: string,
    detalle: Record<string, unknown> = {},
    severidad: OperationalSeverity = "error"
  ): Promise<void> {
    const sanitized = sanitizeDetails({
      ...detalle,
      severity: severidad,
      ruta:
        typeof window !== "undefined" && typeof window.location?.pathname === "string"
          ? window.location.pathname.slice(0, 120)
          : undefined,
      timestamp: new Date().toISOString()
    });

    try {
      const client = crearCliente();
      await registrarEventoOperativoApp(client, {
        tipo,
        versionApp: appVersion(),
        detalle: sanitized
      });
    } catch {
      /* observability must never break operation */
    }

    try {
      const w =
        typeof window !== "undefined"
          ? (window as unknown as {
              Sentry?: {
                captureMessage: (msg: string, opts: unknown) => void;
                captureException: (err: unknown, opts: unknown) => void;
              };
            })
          : null;
      if (w?.Sentry?.captureMessage) {
        w.Sentry.captureMessage(`[${etiquetaSentry}:${tipo}]`, {
          level: severidad,
          extra: sanitized
        });
      }
    } catch {
      /* ignore */
    }
  };
}
