import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/SecondaryTripNavBar.tsx"),
  "utf8"
);

describe("SecondaryTripNavBar - Pestaña y Modal de Gastos con Comprobante", () => {
  it("incluye los tipos de gasto compatibles con la base de datos", () => {
    expect(COMPONENT_FILE).toContain('"combustible"');
    expect(COMPONENT_FILE).toContain('"caseta"');
    expect(COMPONENT_FILE).toContain('"maniobra"');
    expect(COMPONENT_FILE).toContain('"estadia"');
    expect(COMPONENT_FILE).toContain('"penalizacion"');
    expect(COMPONENT_FILE).toContain('"otro"');
  });

  it("permite capturar fotografía mediante cámara nativa (capture=environment)", () => {
    expect(COMPONENT_FILE).toContain('accept="image/*"');
    expect(COMPONENT_FILE).toContain('capture="environment"');
    expect(COMPONENT_FILE).toContain("Tomar foto");
  });

  it("permite subir comprobante o ticket en archivo de imagen o PDF", () => {
    expect(COMPONENT_FILE).toContain('accept="image/*,application/pdf"');
    expect(COMPONENT_FILE).toContain("Subir archivo");
  });

  it("soporta subida al bucket de evidencia y previsualización", () => {
    expect(COMPONENT_FILE).toContain('BUCKET_EVIDENCIA = "evidencia"');
    expect(COMPONENT_FILE).toContain("subirComprobanteGasto");
    expect(COMPONENT_FILE).toContain("URL.createObjectURL");
    expect(COMPONENT_FILE).toContain("handleQuitarComprobante");
  });

  it("guarda el gasto en la tabla gastos_traslado con orden por registrado_en", () => {
    expect(COMPONENT_FILE).toContain('.from("gastos_traslado")');
    expect(COMPONENT_FILE).toContain('.order("registrado_en", { ascending: false })');
    expect(COMPONENT_FILE).toContain("handleEliminarGasto");
  });

  it("P1: nunca persiste signed URLs en gastos y resuelve bajo demanda", () => {
    expect(COMPONENT_FILE).toContain("comprobante_ruta");
    expect(COMPONENT_FILE).toContain("extraerRutaComprobante");
    expect(COMPONENT_FILE).toContain("resolverUrlEvidencia");
    expect(COMPONENT_FILE).not.toContain("createSignedUrl(");
    expect(COMPONENT_FILE).not.toContain("[COMPROBANTE: http");
  });
});
