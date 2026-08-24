/**
 * PERF-004 — p-limit minimal (sin dependencia externa)
 * Limita concurrencia de Promises para no saturar Supabase Storage / PostgREST.
 * API compatible con `p-limit` (https://github.com/sindresorhus/p-limit)
 */
export type Limit = <T>(fn: () => Promise<T>) => Promise<T>;

export function pLimit(concurrency: number): Limit {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("concurrency debe ser un entero >= 1");
  }
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount--;
    const fn = queue.shift();
    if (fn) fn();
  };

  const run = async <T>(fn: () => Promise<T>, resolve: (v: T) => void, reject: (e: unknown) => void) => {
    activeCount++;
    try {
      const result = await fn();
      resolve(result);
    } catch (e) {
      reject(e);
    } finally {
      next();
    }
  };

  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const task = () => run(fn, resolve, reject);
      if (activeCount < concurrency) task();
      else queue.push(task);
    });
}
