import { afterEach, describe, expect, it, vi } from "vitest";

describe("cliente Mapbox usuario", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("expone error claro cuando Geocoding rechaza el token", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.token-valido-formato");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })));

    const { geocodificarDireccion, mensajeErrorMapbox } = await import("./mapbox");

    await expect(geocodificarDireccion("Paseo de la Reforma 222, CDMX")).rejects.toMatchObject({ status: 403 });

    try {
      await geocodificarDireccion("Paseo de la Reforma 222, CDMX");
    } catch (error) {
      // Sec2: mensaje genérico, nunca exponer env var
      expect(mensajeErrorMapbox(error)).toContain("Servicio de mapas no disponible");
    }
  }, 15_000);

  it("expone error claro cuando Directions rechaza el token", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.token-valido-formato");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })));

    const { calcularRutaMapbox, esErrorConfiguracionMapbox } = await import("./mapbox");

    await expect(calcularRutaMapbox({ lat: 19.4326, lng: -99.1332 }, { lat: 19.427, lng: -99.1677 })).rejects.toMatchObject({ status: 403 });

    try {
      await calcularRutaMapbox({ lat: 19.4326, lng: -99.1332 }, { lat: 19.427, lng: -99.1677 });
    } catch (error) {
      expect(esErrorConfiguracionMapbox(error)).toBe(true);
    }
  }, 15_000);

  it("aísla un timeout de Directions como error recuperable", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.token-valido-formato");
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    ));

    const { calcularRutaMapbox, esErrorConfiguracionMapbox, mensajeErrorMapbox } = await import("./mapbox");

    const resultado = calcularRutaMapbox(
      { lat: 19.4326, lng: -99.1332 },
      { lat: 19.427, lng: -99.1677 }
    ).catch((value: unknown) => value);
    await vi.runAllTimersAsync();
    const error = await resultado;

    expect(error).toMatchObject({ status: 504 });
    expect(esErrorConfiguracionMapbox(error)).toBe(true);
    expect(mensajeErrorMapbox(error)).toContain("tardó demasiado");
  });

  it("reintenta Geocoding ante un error transitorio y conserva el resultado", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.token-valido-formato");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "upstream" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ features: [{ geometry: { coordinates: [-99.13, 19.43] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { geocodificarDireccion } = await import("./mapbox");
    const resultado = geocodificarDireccion("Paseo de la Reforma 222, CDMX");
    await vi.runAllTimersAsync();

    await expect(resultado).resolves.toEqual({ lat: 19.43, lng: -99.13 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta cuando el caller cancela la consulta", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.token-valido-formato");
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { geocodificarDireccion } = await import("./mapbox");
    const resultado = geocodificarDireccion("Paseo de la Reforma 222, CDMX", controller.signal);
    await Promise.resolve();
    controller.abort();

    await expect(resultado).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
