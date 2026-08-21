import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCIA_PAGE_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/evidencia/page.tsx"),
  "utf8"
);

const EVIDENCE_WIZARD_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/evidencia/EvidenceWizard.tsx"),
  "utf8"
);

describe("Checklist de Evidencia - Acordeones de Documentos y Notas", () => {
  it("contiene los controles de acordeón para documentos y notas en evidencia/page.tsx", () => {
    expect(EVIDENCIA_PAGE_FILE).toContain("acordeonDocsAbierto");
    expect(EVIDENCIA_PAGE_FILE).toContain("acordeonNotasAbierto");
    expect(EVIDENCIA_PAGE_FILE).toContain("Alternar sección de documentos y placas");
    expect(EVIDENCIA_PAGE_FILE).toContain("Alternar sección de notas");
  });

  it("contiene los controles de acordeón para documentos y notas en EvidenceWizard.tsx", () => {
    expect(EVIDENCE_WIZARD_FILE).toContain("docsAbierto");
    expect(EVIDENCE_WIZARD_FILE).toContain("notasAbierto");
    expect(EVIDENCE_WIZARD_FILE).toContain("📄 Documentos y Placas");
    expect(EVIDENCE_WIZARD_FILE).toContain("📝 Notas o Comentarios");
  });
});
