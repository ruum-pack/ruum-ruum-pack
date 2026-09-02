import { afterEach, describe, expect, it, vi } from "vitest";
import { obtenerRutaDirectionsMapbox } from "./mapbox-directions";

describe("Mapbox Directions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("aborta una petición colgada y expone 504 cuando el caller solicita errores", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(obtenerRutaDirectionsMapbox(
      [-99.13, 19.43],
      [-99.16, 19.42],
      "pk.test",
      { lanzarErrores: true, timeoutMs: 5 }
    )).rejects.toMatchObject({ status: 504 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("degrada a null ante timeout si el caller no solicita errores", async () => {
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    ));

    await expect(obtenerRutaDirectionsMapbox(
      [-99.13, 19.43],
      [-99.16, 19.42],
      "pk.test",
      { timeoutMs: 5 }
    )).resolves.toBeNull();
  });
});
