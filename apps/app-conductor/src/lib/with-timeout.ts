/**
 * PERF-004 — Timeout helper para operaciones Supabase / storage
 * Usa Promise.race + AbortController (cuando la API lo soporta)
 * para evitar colgar la cola offline indefinidamente (ej. 3G lento).
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeout,
  ]);
}

export function withAbortTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number, label = "operation"): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
  return fn(controller.signal).finally(() => clearTimeout(timer));
}
