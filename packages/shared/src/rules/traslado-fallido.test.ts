import { describe, it, expect } from "vitest";
import { clasificarTrasladoFallido } from "./traslado-fallido";

describe("clasificarTrasladoFallido — PRD §4.11 + §4.2", () => {
  it("imputable_cliente: aplica cargo y 50% de descuento en segundo intento (PRD §4.2)", () => {
    const r = clasificarTrasladoFallido("imputable_cliente");
    expect(r.cargo_aplica_cliente).toBe(true);
    expect(r.porcentaje_descuento_segundo_intento).toBe(50);
    expect(r.requiere_reagendamiento).toBe(true);
  });

  it("operativo: sin cargo al cliente", () => {
    const r = clasificarTrasladoFallido("operativo");
    expect(r.cargo_aplica_cliente).toBe(false);
    expect(r.porcentaje_descuento_segundo_intento).toBeUndefined();
  });

  it("fuerza_mayor: sin cargo al cliente", () => {
    expect(clasificarTrasladoFallido("fuerza_mayor").cargo_aplica_cliente).toBe(false);
  });

  it("documentacion: cargo aplica, pero el PRD no fija el descuento de reintento", () => {
    const r = clasificarTrasladoFallido("documentacion");
    expect(r.cargo_aplica_cliente).toBe(true);
    expect(r.porcentaje_descuento_segundo_intento).toBeUndefined();
  });

  it("vehiculo_no_circulable: cargo aplica y NO requiere reagendamiento", () => {
    const r = clasificarTrasladoFallido("vehiculo_no_circulable");
    expect(r.cargo_aplica_cliente).toBe(true);
    expect(r.requiere_reagendamiento).toBe(false);
  });

  it("todas las causas devuelven un mensaje no vacío para la bitácora", () => {
    for (const causa of ["imputable_cliente", "operativo", "fuerza_mayor", "documentacion", "vehiculo_no_circulable"] as const) {
      expect(clasificarTrasladoFallido(causa).mensaje.length).toBeGreaterThan(0);
    }
  });
});
