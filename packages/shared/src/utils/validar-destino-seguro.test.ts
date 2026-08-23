import { describe, expect, it } from "vitest";
import { validarDestinoSeguro } from "./validar-destino-seguro";

describe("validarDestinoSeguro (H6 - Anti Open-Redirect)", () => {
  it("acepta rutas relativas válidas", () => {
    expect(validarDestinoSeguro("/viajes/123")).toBe("/viajes/123");
    expect(validarDestinoSeguro("/cuenta/perfil")).toBe("/cuenta/perfil");
    expect(validarDestinoSeguro("/viajes?filtro=activos")).toBe("/viajes?filtro=activos");
  });

  it("retorna fallback para rutas nulas o vacías", () => {
    expect(validarDestinoSeguro(null)).toBe("/panel");
    expect(validarDestinoSeguro(undefined)).toBe("/panel");
    expect(validarDestinoSeguro("")).toBe("/panel");
    expect(validarDestinoSeguro("   ", "/home")).toBe("/home");
  });

  it("bloquea URLs absolutas con esquemas http/https/javascript", () => {
    expect(validarDestinoSeguro("https://malicious.com")).toBe("/panel");
    expect(validarDestinoSeguro("http://evil.com/phishing")).toBe("/panel");
    expect(validarDestinoSeguro("javascript:alert(1)")).toBe("/panel");
    expect(validarDestinoSeguro("data:text/html,malicious")).toBe("/panel");
  });

  it("bloquea bypasses protocol-relative con doble barra //", () => {
    expect(validarDestinoSeguro("//malicious.com")).toBe("/panel");
    expect(validarDestinoSeguro("///evil.com")).toBe("/panel");
    expect(validarDestinoSeguro("/\\evil.com")).toBe("/panel");
  });

  it("bloquea bypasses con barras invertidas", () => {
    expect(validarDestinoSeguro("/path\\to\\danger")).toBe("/panel");
    expect(validarDestinoSeguro("\\malicious.com")).toBe("/panel");
  });
});
