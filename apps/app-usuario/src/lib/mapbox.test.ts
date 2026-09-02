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
      expect(mensajeErrorMapbox(error)).toContain("Mapbox rechazó el token configurado");
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
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await resultado;

    expect(error).toMatchObject({ status: 504 });
    expect(esErrorConfiguracionMapbox(error)).toBe(true);
    expect(mensajeErrorMapbox(error)).toContain("tardó demasiado");
  });
});
