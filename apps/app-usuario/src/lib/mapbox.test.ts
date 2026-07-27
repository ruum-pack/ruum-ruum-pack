import { afterEach, describe, expect, it, vi } from "vitest";

describe("cliente Mapbox usuario", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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
  });

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
  });
});
