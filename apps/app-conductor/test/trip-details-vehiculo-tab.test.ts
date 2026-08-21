import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/detalles/TripDetailsTabs.tsx"),
  "utf8"
);

describe("TripDetailsTabs - Pestaña Vehículo", () => {
  it("presenta los 11 campos requeridos de la unidad a trasladar", () => {
    // 1. Placas
    expect(COMPONENT_FILE).toContain("Placas");
    // 2. Número VIN
    expect(COMPONENT_FILE).toContain("Número VIN");
    // 3. Marca
    expect(COMPONENT_FILE).toContain("Marca");
    // 4. Modelo
    expect(COMPONENT_FILE).toContain("Modelo");
    // 5. Año
    expect(COMPONENT_FILE).toContain("Año");
    // 6. Color
    expect(COMPONENT_FILE).toContain("Color");
    // 7. Condición
    expect(COMPONENT_FILE).toContain("Condición");
    // 8. Estado general de recepción
    expect(COMPONENT_FILE).toContain("Estado General de Recepción");
    // 9. Categoría
    expect(COMPONENT_FILE).toContain("Categoría");
    // 10. Gama
    expect(COMPONENT_FILE).toContain("Gama");
    // 11. Tipo operativo
    expect(COMPONENT_FILE).toContain("Tipo Operativo");
  });

  it("garantiza la mención a la inspección 360 y evidencia de recepción", () => {
    expect(COMPONENT_FILE).toContain("Garantía de Evidencia Ruum Ruum");
    expect(COMPONENT_FILE).toContain("Inspección 360° fotográfica");
  });
});
