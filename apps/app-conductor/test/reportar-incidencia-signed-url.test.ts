import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/ReportarIncidencia.tsx"),
  "utf8"
);

describe("ReportarIncidencia - P1 Seguridad de Storage sin persistir Signed URLs", () => {
  it("sube evidencia y retorna únicamente ruta privada sin generar signed URLs", () => {
    expect(COMPONENT_FILE).toContain("subirEvidenciaIncidencia");
    expect(COMPONENT_FILE).toContain("BUCKET_EVIDENCIA");
    // No debe generar signed URLs en la función de subida
    expect(COMPONENT_FILE).not.toContain("createSignedUrl(");
  });

  it("almacena solo la ruta privada en la descripción y no URLs temporales ni tokens", () => {
    expect(COMPONENT_FILE).toContain("Evidencia adjunta: ${evidencia.nombre}\\nRuta: ${evidencia.ruta}");
    expect(COMPONENT_FILE).not.toContain("URL temporal:");
    expect(COMPONENT_FILE).not.toContain("urlTemporal");
    expect(COMPONENT_FILE).not.toContain("/object/sign/");
    expect(COMPONENT_FILE).not.toContain("token=");
  });
});
