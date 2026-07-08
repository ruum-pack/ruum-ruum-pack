import { describe, it, expect } from "vitest";
import { consecuenciaCancelacionConductor } from "./cancelacion-conductor";

describe("consecuenciaCancelacionConductor", () => {
  it("primera cancelación sin justificación: suspensión de 30 días", () => {
    const resultado = consecuenciaCancelacionConductor(1);
    expect(resultado.nuevoEstado).toBe("suspendido_30d");
    expect(resultado.diasSuspension).toBe(30);
  });

  it("segunda cancelación sin justificación: bloqueo permanente", () => {
    const resultado = consecuenciaCancelacionConductor(2);
    expect(resultado.nuevoEstado).toBe("bloqueado_permanente");
    expect(resultado.diasSuspension).toBeUndefined();
  });

  it("reincidencias posteriores también son bloqueo permanente", () => {
    expect(consecuenciaCancelacionConductor(3).nuevoEstado).toBe("bloqueado_permanente");
    expect(consecuenciaCancelacionConductor(5).nuevoEstado).toBe("bloqueado_permanente");
  });
});
