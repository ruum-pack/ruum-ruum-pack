import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/LocalizarVehiculoDetails.tsx"),
  "utf8"
);

describe("LocalizarVehiculoDetails - Sección Vehículo a Localizar en Origen", () => {
  it("exhibe los 6 campos requeridos del vehículo a localizar", () => {
    expect(COMPONENT_FILE).toContain("VEHÍCULO A LOCALIZAR");
    expect(COMPONENT_FILE).toContain("PLACAS");
    expect(COMPONENT_FILE).toContain("NÚMERO VIN");
    expect(COMPONENT_FILE).toContain("MARCA");
    expect(COMPONENT_FILE).toContain("MODELO");
    expect(COMPONENT_FILE).toContain("AÑO");
    expect(COMPONENT_FILE).toContain("COLOR");
  });
});
