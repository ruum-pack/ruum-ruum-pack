import { crearClienteNavegador } from "./supabase-browser";

interface FeatureFlagData {
  habilitada: boolean;
  porcentaje_rollout: number;
  versiones_permitidas: string[] | null;
}

interface CacheEntry {
  data: FeatureFlagData | null;
  expiresAt: number;
}

const flagCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60 segundos base
const CACHE_JITTER_MS = 10_000; // ±5s jitter para evitar thundering herd
const MAX_RETRIES = 2;
const inFlight = new Map<string, Promise<FeatureFlagData | null>>();

function jitter(): number {
  return (Math.random() - 0.5) * CACHE_JITTER_MS;
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clearFeatureFlagCache() {
  flagCache.clear();
  inFlight.clear();
}

async function fetchFlagConRetry(key: string, attempt = 0): Promise<{ data: FeatureFlagData | null; error: unknown | null }> {
  try {
    const client = crearClienteNavegador();
    const { data, error } = await client
      .from("feature_flags_app")
      .select("habilitada,porcentaje_rollout,versiones_permitidas")
      .eq("clave", key)
      .maybeSingle();

    if (error) {
      const esRetriable = (error as { code?: string }).code === "PGRST301" || (error as { status?: number }).status === 429;
      if (esRetriable && attempt < MAX_RETRIES) {
        const backoff = 150 * Math.pow(2, attempt) + Math.random() * 100;
        await dormir(backoff);
        return fetchFlagConRetry(key, attempt + 1);
      }
      console.warn("[feature-flags] error consultando feature_flags_app", { key, error, attempt });
      // Observabilidad no bloqueante (best-effort)
      try {
        const { recordOperationalEvent } = await import("./observability");
        void recordOperationalEvent("supabase_error", { scope: "feature_flags", key, attempt }, "warning");
      } catch {}
      return { data: null, error };
    }

    const flagData: FeatureFlagData | null = data
      ? {
          habilitada: Boolean(data.habilitada),
          porcentaje_rollout: Number(data.porcentaje_rollout ?? 0),
          versiones_permitidas: (data.versiones_permitidas as string[] | null) ?? null
        }
      : null;

    if (flagData === null) {
      console.warn("[feature-flags] flag no encontrada, retorna null (RLS o clave inexistente)", { key });
      try {
        const { recordOperationalEvent } = await import("./observability");
        void recordOperationalEvent("supabase_error", { scope: "feature_flags_missing", key }, "warning");
      } catch {}
    }

    return { data: flagData, error: null };
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

export async function getFeatureFlagData(key: string, forceRefresh = false): Promise<FeatureFlagData | null> {
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
    const result = await promesa;
    return result;
  } finally {
    inFlight.delete(key);
  }
}

export async function isFeatureEnabled(key: string, userId?: string, forceRefresh = false): Promise<boolean> {
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
