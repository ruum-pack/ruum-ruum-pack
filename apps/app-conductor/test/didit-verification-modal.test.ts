import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODAL_FILE = readFileSync(
  resolve(__dirname, "../src/app/registro/DiditVerificationModal.tsx"),
  "utf8"
);

const CONDUCTORES_SERVICE = readFileSync(
  resolve(__dirname, "../../../packages/api/src/services/conductores.ts"),
  "utf8"
);

describe("DiditVerificationModal y Servicio de Verificación", () => {
  it("valida estrictamente la URL antes de renderizar el iframe para prevenir auto-framing clickjacking", () => {
    expect(MODAL_FILE).toContain("function esUrlDiditValida");
    expect(MODAL_FILE).toContain('startsWith("https://")');
    expect(MODAL_FILE).toContain('parsed.hostname === "verify.didit.me"');
    expect(MODAL_FILE).toContain("urlValida && url");
    expect(MODAL_FILE).toContain("<iframe");
    expect(MODAL_FILE).toContain("allow=\"camera; microphone; geolocation; fullscreen; accelerometer; gyroscope; display-capture; autoplay\"");
    expect(MODAL_FILE).toContain("sandbox=\"allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation allow-top-navigation-by-user-activation\"");
  });

  it("muestra fallback seguro y aviso cuando la URL de Didit es inválida o no se recibe", () => {
    expect(MODAL_FILE).toContain("No se recibió una URL válida de verificación de Didit.");
    expect(MODAL_FILE).toContain("Reintentar");
  });

  it("el servicio conductores.ts valida que la URL de Didit sea https antes de entregarla al cliente", () => {
    expect(CONDUCTORES_SERVICE).toContain("urlFinal.startsWith(\"https://\")");
    expect(CONDUCTORES_SERVICE).toContain("No se recibió una URL válida del servicio de verificación de identidad.");
  });
});
