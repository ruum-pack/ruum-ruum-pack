import { describe, expect, it } from "vitest";
import { fortalezaPassword } from "./fortaleza-password";

describe("fortalezaPassword", () => {
  it("devuelve nivel 0 sin etiqueta para contraseñas de menos de 6 caracteres", () => {
    expect(fortalezaPassword("")).toEqual({ nivel: 0, etiqueta: "" });
    expect(fortalezaPassword("abc12")).toEqual({ nivel: 0, etiqueta: "" });
  });

  it("marca como débil (nivel 1) las contraseñas cortas de solo minúsculas", () => {
    const resultado = fortalezaPassword("caminito");
    expect(resultado.nivel).toBe(1);
    expect(resultado.etiqueta).toContain("Débil");
  });

  it("sube a media (nivel 2) al cumplir dos criterios", () => {
    // longitud >= 10 + número
    expect(fortalezaPassword("carretera2026").nivel).toBe(2);
    // mayúscula + número, corta
    expect(fortalezaPassword("Ruta57mx").nivel).toBe(2);
  });

  it("marca como fuerte (nivel 3) con tres o más criterios", () => {
    const resultado = fortalezaPassword("Carretera-2026");
    expect(resultado.nivel).toBe(3);
    expect(resultado.etiqueta).toBe("Fuerte");
  });

  it("cuenta símbolos como criterio adicional", () => {
    expect(fortalezaPassword("abc!123").nivel).toBe(2);
  });
});
