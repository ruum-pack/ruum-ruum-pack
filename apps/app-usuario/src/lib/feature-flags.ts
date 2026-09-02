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
const CACHE_TTL_MS = 60_000; // 60 segundos de caché en memoria

export function clearFeatureFlagCache() {
  flagCache.clear();
}

export async function getFeatureFlagData(key: string, forceRefresh = false): Promise<FeatureFlagData | null> {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = flagCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }
  }

  try {
    const client = crearClienteNavegador();
    const { data, error } = await client
      .from("feature_flags_app")
      .select("habilitada,porcentaje_rollout,versiones_permitidas")
      .eq("clave", key)
      .maybeSingle();

    if (error) {
      return null;
    }

    const flagData: FeatureFlagData | null = data
      ? {
          habilitada: Boolean(data.habilitada),
          porcentaje_rollout: Number(data.porcentaje_rollout ?? 0),
          versiones_permitidas: (data.versiones_permitidas as string[] | null) ?? null
        }
      : null;

    flagCache.set(key, { data: flagData, expiresAt: now + CACHE_TTL_MS });
    return flagData;
  } catch {
    return null;
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
