import { Redis } from "@upstash/redis";

export const MAX_BODY = 5 * 1024;
export const RATE_WINDOW_MS = 60_000;
export const MAX_PER_WINDOW = 10;

const hits = new Map<string, { count: number; resetAt: number }>();
let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasUpstash && !hasKv) {
    redisClient = null;
    return redisClient;
  }
  try {
    if (hasUpstash) {
      redisClient = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
      return redisClient;
    }
    if (hasKv) {
      redisClient = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
      return redisClient;
    }
    redisClient = Redis.fromEnv();
    return redisClient;
  } catch {
    redisClient = null;
  }
  return redisClient;
}

export function __clearCspRateLimitForTest() {
  hits.clear();
}

export async function rateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const redis = getRedis();
  if (redis) {
    try {
      const key = `csp-report:${ip}`;
      const count = (await redis.incr(key)) as number;
      if (count === 1) {
        await redis.expire(key, Math.ceil(RATE_WINDOW_MS / 1000));
      }
      if (count > MAX_PER_WINDOW) {
        const ttl = (await redis.ttl(key)) as number;
        const retryAfterSec = ttl > 0 ? ttl : Math.ceil(RATE_WINDOW_MS / 1000);
        return { allowed: false, retryAfterSec };
      }
      return { allowed: true };
    } catch (e) {
      console.warn("[csp-report-usuario] redis rate-limit fallo, fallback a memoria", e);
    }
  }
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  entry.count += 1;
  return { allowed: true };
}
