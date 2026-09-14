import { obtenerFeatureFlagApp, type FeatureFlagApp } from "../operations";
import type { OperationalSeverity } from "../observability";
import type { CrearClienteNavegador } from "../observability";

export type { FeatureFlagApp };

export type ReportarFlagError = (
  tipo: string,
  detalle: Record<string, unknown>,
  severidad: OperationalSeverity
) => void;

interface CacheEntry {
  data: FeatureFlagApp | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 segundos base
const CACHE_JITTER_MS = 10_000; // ±5s jitter para evitar thundering herd
const MAX_RETRIES = 2;

function jitter(): number {
  return (Math.random() - 0.5) * CACHE_JITTER_MS;
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Feature flags con caché TTL + jitter, deduplicación de fetches en vuelo,
 * retry con backoff, sync cross-tab y reporte de errores no bloqueante.
 * `reportar` lo conecta cada app con su observabilidad (ver facades en apps).
 */
export function crearFeatureFlags({
  crearCliente,
  reportar
}: {
  /** Se inyecta desde la app para que los mocks de tests (`lib/supabase-browser`) sigan funcionando. */
  crearCliente: CrearClienteNavegador;
  reportar?: ReportarFlagError;
}) {
  const flagCache = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<FeatureFlagApp | null>>();

  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("ruum:feature-flags");
      bc.onmessage = (ev: MessageEvent) => {
        if ((ev.data as { type?: string })?.type === "clear") {
          flagCache.clear();
          inFlight.clear();
        }
      };
    }
  } catch {}

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") clearFeatureFlagCache();
    });
  }

  function clearFeatureFlagCache() {
    flagCache.clear();
    inFlight.clear();
    try {
      bc?.postMessage({ type: "clear" });
    } catch {}
  }

  async function fetchFlagConRetry(
    key: string,
    attempt = 0
  ): Promise<{ data: FeatureFlagApp | null; error: unknown | null }> {
    try {
      const client = crearCliente();
      let data: FeatureFlagApp | null;
      try {
        data = await obtenerFeatureFlagApp(client, key);
      } catch (error) {
        const esRetriable =
          (error as { code?: string }).code === "PGRST301" ||
          (error as { status?: number }).status === 429;
        if (esRetriable && attempt < MAX_RETRIES) {
          const backoff = 150 * Math.pow(2, attempt) + Math.random() * 100;
          await dormir(backoff);
          return fetchFlagConRetry(key, attempt + 1);
        }
        console.warn("[feature-flags] error consultando feature_flags_app", { key, error, attempt });
        try {
          reportar?.("supabase_error", { scope: "feature_flags", key, attempt }, "warning");
        } catch {}
        return { data: null, error };
      }

      if (data === null) {
        console.warn("[feature-flags] flag no encontrada, retorna null (RLS o clave inexistente)", { key });
        try {
          reportar?.("supabase_error", { scope: "feature_flags_missing", key }, "warning");
        } catch {}
      }

      return { data, error: null };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const backoff = 150 * Math.pow(2, attempt) + Math.random() * 100;
        await dormir(backoff);
        return fetchFlagConRetry(key, attempt + 1);
      }
      console.warn("[feature-flags] excepción", { key, err, attempt });
      return { data: null, error: err };
    }
  }

  async function getFeatureFlagData(key: string, forceRefresh = false): Promise<FeatureFlagApp | null> {
    const now = Date.now();
    if (!forceRefresh) {
      const cached = flagCache.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.data;
      }
      // Deduplicar thundering herd: si ya hay fetch en vuelo para esta key, reutilizar
      const vuelo = inFlight.get(key);
      if (vuelo) return vuelo;
    }

    const promesa = (async () => {
      const { data } = await fetchFlagConRetry(key);
      const expiresAt = Date.now() + CACHE_TTL_MS + jitter();
      flagCache.set(key, { data, expiresAt });
      return data;
    })();

    inFlight.set(key, promesa);
    try {
      return await promesa;
    } finally {
      inFlight.delete(key);
    }
  }

  async function isFeatureEnabled(key: string, userId?: string, forceRefresh = false): Promise<boolean> {
    const data = await getFeatureFlagData(key, forceRefresh);
    if (!data?.habilitada) return false;

    const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
    if (data.versiones_permitidas?.length && !data.versiones_permitidas.includes(version)) {
      return false;
    }

    if (data.porcentaje_rollout >= 100) return true;
    if (!userId) return false;

    let hash = 0;
    for (const c of `${key}:${userId}`) {
      hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    }
    return hash % 100 < data.porcentaje_rollout;
  }

  return { clearFeatureFlagCache, getFeatureFlagData, isFeatureEnabled };
}
