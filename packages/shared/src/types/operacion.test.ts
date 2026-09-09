import { describe, expect, it } from "vitest";
import { esTransicionOperacionValida } from "./operacion";

describe("transiciones de operación", () => {
  it("permite borrador -> planificada -> en_curso -> cerrada", () => {
    expect(esTransicionOperacionValida("borrador", "planificada")).toBe(true);
    expect(esTransicionOperacionValida("planificada", "en_curso")).toBe(true);
    expect(esTransicionOperacionValida("en_curso", "cerrada")).toBe(true);
  });

  it("rechaza saltos como borrador -> cerrada", () => {
    expect(esTransicionOperacionValida("borrador", "cerrada")).toBe(false);
    expect(esTransicionOperacionValida("cerrada", "en_curso")).toBe(false);
  });

  it("permite pausa y retorno", () => {
    expect(esTransicionOperacionValida("en_curso", "pausada")).toBe(true);
    expect(esTransicionOperacionValida("pausada", "en_curso")).toBe(true);
  });
});
