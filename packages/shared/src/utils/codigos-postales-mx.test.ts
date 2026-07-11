import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarCodigoPostalMx } from "./codigos-postales-mx";

const SHARD_01 = {
  "01210": { estado: "Ciudad de México", ciudades: ["Álvaro Obregón", "Ciudad de México"], colonias: ["Santa Fe"] }
};

function mockFetchOk(body: unknown) {
  return vi.fn(async () => ({ ok: true, json: async () => body }));
}

describe("consultarCodigoPostalMx", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rechaza códigos postales que no son de 5 dígitos sin llamar a fetch", async () => {
    const fetchEspiado = vi.fn();
    vi.stubGlobal("fetch", fetchEspiado);
    expect(await consultarCodigoPostalMx("123")).toBeNull();
    expect(fetchEspiado).not.toHaveBeenCalled();
  });

  // Cada test usa una rutaBase distinta: la caché interna del módulo vive
  // por prefijo+rutaBase durante toda la ejecución, y así evitamos que un
  // test reutilice la respuesta cacheada de otro.
  it("devuelve el registro correspondiente al CP dentro de su shard", async () => {
    vi.stubGlobal("fetch", mockFetchOk(SHARD_01));
    const resultado = await consultarCodigoPostalMx("01210", { rutaBase: "/test-a" });
    expect(resultado).toEqual(SHARD_01["01210"]);
  });

  it("pide el shard correcto según el prefijo de 2 dígitos", async () => {
    const fetchEspiado = mockFetchOk(SHARD_01);
    vi.stubGlobal("fetch", fetchEspiado);
    await consultarCodigoPostalMx("01210", { rutaBase: "/test-b" });
    expect(fetchEspiado).toHaveBeenCalledWith("/test-b/01.json");
  });

  it("devuelve null si el CP no existe dentro de su shard", async () => {
    vi.stubGlobal("fetch", mockFetchOk(SHARD_01));
    expect(await consultarCodigoPostalMx("01999", { rutaBase: "/test-c" })).toBeNull();
  });

  it("devuelve null sin lanzar si la red falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sin conexión");
      })
    );
    expect(await consultarCodigoPostalMx("01210", { rutaBase: "/test-d" })).toBeNull();
  });
});
