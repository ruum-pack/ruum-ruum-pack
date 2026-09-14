import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dirDatosCP, rutaShardCP } from "./datos-cp";

const cwdOriginal = process.cwd();
let cwdTemporal: string | null = null;

afterEach(() => {
  if (cwdTemporal) {
    process.chdir(cwdOriginal);
    cwdTemporal = null;
  }
});

function irATemporalSinDatos() {
  cwdTemporal = mkdtempSync(join(tmpdir(), "panel-cp-"));
  process.chdir(cwdTemporal);
}

describe("lib/datos-cp — fuente propia primero, fallback legacy después", () => {
  it("resuelve al directorio propio del panel cuando existe", () => {
    const dir = dirDatosCP();
    expect(dir.split(sep).slice(-4).join("/")).toBe("panel-admin/public/data/codigos-postales");
  });

  it("rutaShardCP compone <dir>/<prefijo>.json", () => {
    expect(rutaShardCP("01")).toBe(join(dirDatosCP(), "01.json"));
  });

  it("usa el fallback legacy ../app-usuario cuando el panel no tiene datos", () => {
    // Estructura temporal: <tmp>/panel (cwd) + <tmp>/app-usuario/public/data/codigos-postales
    irATemporalSinDatos();
    const raiz = cwdTemporal as string;
    mkdirSync(join(raiz, "panel"));
    mkdirSync(join(raiz, "app-usuario", "public", "data", "codigos-postales"), { recursive: true });
    writeFileSync(join(raiz, "app-usuario", "public", "data", "codigos-postales", "01.json"), "{}");
    process.chdir(join(raiz, "panel"));
    expect(dirDatosCP()).toBe(join(raiz, "app-usuario", "public", "data", "codigos-postales"));
  });

  it("lanza error accionable cuando no hay datos en ningún candidato", () => {
    irATemporalSinDatos();
    expect(() => dirDatosCP()).toThrowError(/pnpm cp:generar/);
  });
});
