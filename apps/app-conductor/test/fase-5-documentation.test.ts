import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("documentacion de Fase 5", () => {
  it("mantiene actualizado el README de App Conductor", () => {
    const readme = readRepoFile("apps/app-conductor/README.md");

    expect(readme).toContain("## Arquitectura actual");
    expect(readme).toContain("## Evidencia privada");
    expect(readme).toContain("signed URLs");
    expect(readme).toContain("## Cola offline");
    expect(readme).toContain("conductor_confirmar_llegada_destino");
    expect(readme).toContain("p_fuera_geocerca");
    expect(readme).toContain("## Temas y tarjetas");
    expect(readme).toContain("## Comandos de test");
    expect(readme).toContain("## Dispositivos probados");
    expect(readme).toContain("## Funcionalidades pendientes reales");
    expect(readme).toContain("no hay shell local completo");
    expect(readme).not.toContain("mientras Supabase Storage no esté conectado");
    expect(readme).not.toContain("URL de marcador de posición");
  });

  it("define el acta QA con campos obligatorios y decisiones pendientes", () => {
    const acta = readRepoFile("docs/qa/fase-5-validacion.md");

    for (const campo of [
      "Commit",
      "Fecha",
      "Ambiente",
      "Build",
      "Dispositivo",
      "Version Android",
      "Ejecutor",
      "Caso",
      "Resultado",
      "Evidencia",
      "Incidencias",
      "Decision"
    ]) {
      expect(acta).toContain(campo);
    }

    expect(acta).toContain("OP-OFF-01");
    expect(acta).toContain("EV-QUE-01");
    expect(acta).toContain("AND-BKP-01");
    expect(acta).toContain("Producto");
    expect(acta).toContain("Operacion");
    expect(acta).toContain("Tecnologia");
  });

  it("publica artifacts de CI con retencion por tipo de rama", () => {
    const ci = readRepoFile(".github/workflows/ci.yml");

    expect(ci).toContain("retention-days: ${{ github.event_name == 'pull_request' && 14 || 90 }}");
    expect(ci).toContain("apps/app-conductor/playwright-report/");
    expect(ci).toContain("apps/app-conductor/results/axe-results.json");
    expect(ci).toContain("apps/app-conductor/.lighthouse-ci/*.html");
    expect(ci).toContain("apps/app-conductor/.lighthouse-ci/*.json");
    expect(ci).toContain("apps/app-conductor/storybook-static/");
    expect(ci).toContain("apps/app-conductor/artifacts/a11y/");
    expect(ci).toContain("apps/app-conductor/test-results/");
    expect(ci).toContain("!apps/app-conductor/tests/.auth/");
  });
});

