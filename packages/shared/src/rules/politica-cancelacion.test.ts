import { describe, it, expect } from "vitest";
import { calcularCargoCancelacion } from "./politica-cancelacion";

describe("calcularCargoCancelacion — PRD §4.7", () => {
  it("antes de conductor asignado -> 0%", () => {
    const r = calcularCargoCancelacion(1000, 10, false, false);
    expect(r.porcentaje_cargo).toBe(0);
    expect(r.monto_cargo).toBe(0);
  });

  it("conductor ya llegó al punto de recolección -> 100%, sin importar las horas", () => {
    const r = calcularCargoCancelacion(1000, 10, true, true);
    expect(r.porcentaje_cargo).toBe(100);
    expect(r.monto_cargo).toBe(1000);
  });

  it("asignado, faltando >= 6h -> 20%", () => {
    const r = calcularCargoCancelacion(1000, 6, true, false);
    expect(r.porcentaje_cargo).toBe(20);
    expect(r.monto_cargo).toBe(200);
  });

  it("asignado, faltando entre 4h y <6h -> 35%", () => {
    const r = calcularCargoCancelacion(1000, 4, true, false);
    expect(r.porcentaje_cargo).toBe(35);
    expect(r.monto_cargo).toBe(350);
  });

  it("asignado, faltando entre 2h y <4h -> 50%", () => {
    const r = calcularCargoCancelacion(1000, 2, true, false);
    expect(r.porcentaje_cargo).toBe(50);
    expect(r.monto_cargo).toBe(500);
  });

  it("asignado, faltando < 2h -> 75%", () => {
    const r = calcularCargoCancelacion(1000, 1.5, true, false);
    expect(r.porcentaje_cargo).toBe(75);
    expect(r.monto_cargo).toBe(750);
  });

  it("el mensaje obligatorio incluye el porcentaje calculado (PRD §4.7)", () => {
    const r = calcularCargoCancelacion(1000, 6, true, false);
    expect(r.mensaje).toBe("Cancelar ahora genera un cargo del 20%. ¿Deseas continuar?");
  });
});
