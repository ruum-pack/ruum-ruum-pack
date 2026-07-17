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

  it("define color-scheme de controles nativos por tema", () => {
    const tokensCss = readFileSync(join(process.cwd(), "..", "..", "packages", "ui", "src", "styles", "tokens.css"), "utf8");

    expect(tokensCss).toContain('[data-theme="light"] input');
    expect(tokensCss).toContain('[data-theme="dark"] input');
    expect(tokensCss).toContain("color-scheme: dark;");
    expect(tokensCss).not.toMatch(/(^|\n)input,\s*\nselect,\s*\ntextarea\s*\{\s*\n\s*color-scheme:\s*light;/);
  });

  it("no usa text-xs en errores, rechazos o información sensible", () => {
    const patronCritico =
      /text-xs[^"'`>\n]*(?:danger-action|warning|rechaz|motivo|privacidad|aviso|error|bloqueante)|(?:rechaz|motivo|privacidad|aviso|error|bloqueante)[^"'`>\n]*text-xs/i;
    const hallazgos = RAICES_REVISION.flatMap((raiz) =>
      archivosRevisables(raiz).flatMap((ruta) => {
        const contenido = readFileSync(ruta, "utf8");
        return contenido
          .split("\n")
          .map((linea, indice) => ({ linea, indice: indice + 1 }))
          .filter(({ linea }) => patronCritico.test(linea))
          .map(({ linea, indice }) => `${ruta}:${indice}: ${linea.trim()}`);
      })
    );

    expect(hallazgos).toEqual([]);
  });
});
