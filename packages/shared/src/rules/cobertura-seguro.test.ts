import { describe, it, expect } from "vitest";
import { estaDentroDeCobertura, siguienteEstadoReclamo, dentroDePlazoConfirmacionDano } from "./cobertura-seguro";

describe("estaDentroDeCobertura — PRD §4.9", () => {
  it("cubre daño en vehiculo_recibido si no es preexistente", () => {
    expect(estaDentroDeCobertura("vehiculo_recibido", false)).toBe(true);
  });

  it("cubre daño en entrega_confirmada", () => {
    expect(estaDentroDeCobertura("entrega_confirmada", false)).toBe(true);
  });

  it("NO cubre daño preexistente documentado en evidencia inicial", () => {
    expect(estaDentroDeCobertura("traslado_en_curso", true)).toBe(false);
  });

  it("NO cubre estados fuera de la custodia operativa (antes de vehiculo_recibido)", () => {
    expect(estaDentroDeCobertura("conductor_en_punto_de_recoleccion", false)).toBe(false);
  });

  it("NO cubre estados posteriores al cierre", () => {
    expect(estaDentroDeCobertura("servicio_cerrado", false)).toBe(false);
  });
});

describe("siguienteEstadoReclamo — PRD §4.9 MVP del flujo de reclamo", () => {
  it("sin_reclamo -> abierto al activar reclamo", () => {
    expect(siguienteEstadoReclamo("sin_reclamo", "admin_activa_reclamo").estado).toBe("abierto");
  });

  it("abierto -> en_revision al actualizar seguimiento", () => {
    expect(siguienteEstadoReclamo("abierto", "admin_actualiza_seguimiento").estado).toBe("en_revision");
  });

  it("en_revision -> resuelto al resolver", () => {
    expect(siguienteEstadoReclamo("en_revision", "admin_resuelve").estado).toBe("resuelto");
  });

  it("abierto -> resuelto directamente también es válido", () => {
    expect(siguienteEstadoReclamo("abierto", "admin_resuelve").estado).toBe("resuelto");
  });

  it("lanza error en una transición inválida", () => {
    expect(() => siguienteEstadoReclamo("resuelto", "admin_activa_reclamo")).toThrow();
  });
});

describe("dentroDePlazoConfirmacionDano — PRD §4.9 (48 horas)", () => {
  it("dentro de las 48 horas", () => expect(dentroDePlazoConfirmacionDano(47)).toBe(true));
  it("exactamente en el límite", () => expect(dentroDePlazoConfirmacionDano(48)).toBe(true));
  it("fuera del plazo", () => expect(dentroDePlazoConfirmacionDano(49)).toBe(false));
});
