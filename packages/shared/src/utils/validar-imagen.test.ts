import { describe, expect, it } from "vitest";
import { validarDimensionesMinimasImagen, obtenerDimensionesImagen } from "./validar-imagen";

describe("Validación de dimensiones mínimas de imagen", () => {
  it("retorna válido si el archivo no es una imagen (ej. PDF)", async () => {
    const pdfBlob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const res = await validarDimensionesMinimasImagen(pdfBlob, 300, 300);
    expect(res.valido).toBe(true);
    expect(await obtenerDimensionesImagen(pdfBlob)).toBeNull();
  });

  it("permite validar correctamente cuando createImageBitmap está disponible", async () => {
    const originalCreateImageBitmap = globalThis.createImageBitmap;

    // Simular imagen pequeña (150x150)
    globalThis.createImageBitmap = async () =>
      ({
        width: 150,
        height: 150,
        close: () => {}
      } as unknown as ImageBitmap);

    const imgPequena = new Blob(["fake-image"], { type: "image/jpeg" });
    const resPequena = await validarDimensionesMinimasImagen(imgPequena, 300, 300);
    expect(resPequena.valido).toBe(false);
    expect(resPequena.error).toContain("resolución mínima de 300x300");

    // Simular imagen adecuada (800x600)
    globalThis.createImageBitmap = async () =>
      ({
        width: 800,
        height: 600,
        close: () => {}
      } as unknown as ImageBitmap);

    const imgAdecuada = new Blob(["fake-image"], { type: "image/jpeg" });
    const resAdecuada = await validarDimensionesMinimasImagen(imgAdecuada, 300, 300);
    expect(resAdecuada.valido).toBe(true);
    expect(resAdecuada.ancho).toBe(800);
    expect(resAdecuada.alto).toBe(600);

    globalThis.createImageBitmap = originalCreateImageBitmap;
  });
});
