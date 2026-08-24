import { describe, it, expect } from "vitest";
import { pLimit } from "../src/lib/p-limit";

describe("p-limit — PERF-004 concurrencia 2", () => {
  it("limita a 2 concurrentes", async () => {
    const limit = pLimit(2);
    let concurrent = 0;
    let maxConcurrent = 0;
    const tasks = Array.from({ length: 5 }, (_, i) =>
      limit(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
        return i;
      })
    );
    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(maxConcurrent).toBe(2);
  });

  it("concurrencia 1 es secuencial", async () => {
    const limit = pLimit(1);
    const order: number[] = [];
    await Promise.all([
      limit(async () => { await new Promise((r) => setTimeout(r, 5)); order.push(1); }),
      limit(async () => { order.push(2); }),
      limit(async () => { order.push(3); }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("propaga errores sin bloquear queue", async () => {
    const limit = pLimit(2);
    const ok = limit(async () => 42);
    const fail = limit(async () => { throw new Error("boom"); });
    await expect(fail).rejects.toThrow("boom");
    await expect(ok).resolves.toBe(42);
    // siguiente tarea debe seguir funcionando
    await expect(limit(async () => 7)).resolves.toBe(7);
  });

  it("valida concurrency inválido", () => {
    expect(() => pLimit(0)).toThrow(TypeError);
    expect(() => pLimit(0.5)).toThrow(TypeError);
  });

  it("preserva orden de resultados con Promise.all", async () => {
    const limit = pLimit(3);
    const tasks = [1, 2, 3].map((n) => limit(async () => n * 2));
    expect(await Promise.all(tasks)).toEqual([2, 4, 6]);
  });
});
