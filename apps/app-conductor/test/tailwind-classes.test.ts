import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAICES_REVISION = [
  join(process.cwd(), "src"),
  join(process.cwd(), "..", "..", "packages", "ui", "src")
];

const EXTENSIONES_REVISADAS = new Set([".css", ".ts", ".tsx"]);
const CLASES_INVALIDAS_CONOCIDAS = ["bg-surface-elevated5"];
const TOKEN_SEMANTICO_CON_NUMERO =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to)-(?:surface|text|border|route|action|danger|success|warning|control|signal|warn|paper|mist|ink)(?:-[a-z]+)*\d+\b/g;

function extension(ruta: string) {
  const indice = ruta.lastIndexOf(".");
  return indice >= 0 ? ruta.slice(indice) : "";
}

function archivosRevisables(raiz: string): string[] {
  return readdirSync(raiz).flatMap((nombre) => {
    const ruta = join(raiz, nombre);
    const stat = statSync(ruta);
    if (stat.isDirectory()) return archivosRevisables(ruta);
    return EXTENSIONES_REVISADAS.has(extension(ruta)) ? [ruta] : [];
  });
}

describe("clases Tailwind semánticas", () => {
  it("no contiene tokens semánticos con sufijos numéricos accidentales", () => {
    const hallazgos = RAICES_REVISION.flatMap((raiz) =>
      archivosRevisables(raiz).flatMap((ruta) => {
        const contenido = readFileSync(ruta, "utf8");
        const conocidas = CLASES_INVALIDAS_CONOCIDAS
          .filter((clase) => contenido.includes(clase))
          .map((clase) => `${ruta}: ${clase}`);
        const sospechosas = Array.from(contenido.matchAll(TOKEN_SEMANTICO_CON_NUMERO), (match) => `${ruta}: ${match[0]}`);
        return [...conocidas, ...sospechosas];
      })
    );

    expect(hallazgos).toEqual([]);
  });
});
