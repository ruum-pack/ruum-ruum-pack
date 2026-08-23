import { describe, expect, it, vi } from "vitest";
import { capturarFoto, comprimirDataUrl, seleccionarFotoGaleria } from "../src/lib/camara";

vi.mock("../src/lib/capacitor", () => ({
  esNativo: vi.fn(() => false)
}));

describe("Cámara y Compresión de Evidencia", () => {
  it("en entorno no nativo capturarFoto retorna null", async () => {
    const foto = await capturarFoto();
    expect(foto).toBeNull();
  });

  it("en entorno no nativo seleccionarFotoGaleria retorna null", async () => {
    const foto = await seleccionarFotoGaleria();
    expect(foto).toBeNull();
  });

  it("comprimirDataUrl retorna el mismo string si no empieza con data:image", async () => {
    const raw = "not_an_image_string";
    const res = await comprimirDataUrl(raw);
    expect(res).toBe(raw);
  });

  it("comprimirDataUrl retorna el mismo string si ya es pequeño (<600KB)", async () => {
    const smallDataUrl = "data:image/jpeg;base64,AAAA";
    const res = await comprimirDataUrl(smallDataUrl);
    expect(res).toBe(smallDataUrl);
  });
});
