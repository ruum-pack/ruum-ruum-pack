import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("validacion de arranque sin red", () => {
  it("documenta los escenarios criticos de perdida de red", () => {
    const doc = readProjectFile("tests/android/offline-startup-validation.md");

    expect(doc).toContain("App ya abierta y luego pierde red");
    expect(doc).toContain("App en segundo plano y pierde red");
    expect(doc).toContain("App cerrada y se intenta abrir sin red");
    expect(doc).toContain("App cerrada con viaje activo y evidencia pendiente");
  });

  it("mantiene explicita la decision de piloto y la iniciativa de produccion", () => {
    const doc = readProjectFile("tests/android/offline-startup-validation.md");

    expect(doc).toContain("Mitigacion elegida para piloto");
    expect(doc).toContain("La App Conductor debe permanecer abierta durante el traslado");
    expect(doc).toContain("Iniciativa requerida para produccion");
    expect(doc).toContain("Shell local operativo");
    expect(doc).toContain("Producto, Operacion y Tecnologia");
  });
});

