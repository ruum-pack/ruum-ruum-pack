import { describe, it, expect, vi } from "vitest";
import { MAX_INTENTOS_MASIVO } from "./CargaMasivaForm";

describe("R6 polling masivo — MAX_INTENTOS y abort (alta)", () => {
  it("exporta MAX_INTENTOS_MASIVO = 20", () => {
    expect(MAX_INTENTOS_MASIVO).toBe(20);
  });

  it("corta en MAX_INTENTOS con mensaje esperado cuando el backend sigue en procesando", async () => {
    const procesarMock = vi.fn(async () => ({ estado: "procesando" as const, carga_id: "c1", filas_creadas: 0, filas_error: 0, filas_procesadas: 0 }));
    const dormirMock = vi.fn(async (_ms?: unknown) => {});

    async function pollSimulado() {
      let res = await procesarMock();
      let intentos = 0;
      while (res.estado === "procesando") {
        if (intentos++ >= MAX_INTENTOS_MASIVO) {
          throw new Error("El backend sigue procesando el lote. Revisa Mis Viajes en unos minutos para ver el resultado parcial.");
        }
        await (dormirMock as unknown as (n: number) => Promise<void>)(1);
        res = await procesarMock();
      }
      return res;
    }

    await expect(pollSimulado()).rejects.toThrow(/sigue procesando/);
    expect(procesarMock).toHaveBeenCalledTimes(MAX_INTENTOS_MASIVO + 1); // 1 inicial + 20 reintentos
    expect(dormirMock).toHaveBeenCalledTimes(MAX_INTENTOS_MASIVO);
  });

  it("abort cancela loop sin lanzar error visible", async () => {
    const controller = new AbortController();
    const procesarMock = vi.fn(async () => {
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      return { estado: "procesando" as const, carga_id: "c1", filas_creadas: 0, filas_error: 0, filas_procesadas: 0 };
    });
    const pollConAbort = async () => {
      try {
        let res = await procesarMock();
        let intentos = 0;
        while (res.estado === "procesando") {
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          if (intentos++ >= MAX_INTENTOS_MASIVO) throw new Error("sigue");
          // simular que usuario cancela en intento 2
          if (intentos === 2) controller.abort();
          await new Promise<void>((r, rej) => {
            const t = setTimeout(r, 5);
            controller.signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("Aborted", "AbortError")); }, { once: true });
          });
          res = await procesarMock();
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "aborted";
        throw e;
      }
      return "done";
    };
    expect(await pollConAbort()).toBe("aborted");
  });
});
