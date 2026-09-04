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

  it("reintenta respuestas transitorias cuando se solicita resiliencia", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "upstream" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        routes: [{ distance: 12_345, duration: 3_600, geometry: null }]
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(obtenerRutaDirectionsMapbox(
      [-99.13, 19.43],
      [-99.16, 19.42],
      "pk.test",
      { lanzarErrores: true, maxIntentos: 2, demoraReintentoMs: 0 }
    )).resolves.toMatchObject({ distanciaKm: 12.35, tiempoHoras: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancela la espera entre reintentos si el caller aborta", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "upstream" }), { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = obtenerRutaDirectionsMapbox(
      [-99.13, 19.43],
      [-99.16, 19.42],
      "pk.test",
      { lanzarErrores: true, signal: controller.signal, maxIntentos: 3, demoraReintentoMs: 10_000 }
    );
    await Promise.resolve();
    controller.abort();

    await expect(resultado).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
