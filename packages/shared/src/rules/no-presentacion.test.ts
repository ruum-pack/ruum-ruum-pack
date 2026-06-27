import { describe, it, expect } from "vitest";
import { consecuenciaNoPresentacion } from "./no-presentacion";

describe("consecuenciaNoPresentacion — PRD §4.8", () => {
  it("1ra ocurrencia en 6 meses -> suspensión 7 días", () => {
    const r = consecuenciaNoPresentacion(1);
    expect(r.nuevoEstado).toBe("suspendido_7d");
    expect(r.diasSuspension).toBe(7);
  });

  it("2da ocurrencia -> suspensión 14 días", () => {
    const r = consecuenciaNoPresentacion(2);
    expect(r.nuevoEstado).toBe("suspendido_14d");
    expect(r.diasSuspension).toBe(14);
  });

  it("3ra ocurrencia -> suspensión 30 días", () => {
    const r = consecuenciaNoPresentacion(3);
    expect(r.nuevoEstado).toBe("suspendido_30d");
    expect(r.diasSuspension).toBe(30);
  });

  it("4ta ocurrencia -> suspensión indefinida", () => {
    expect(consecuenciaNoPresentacion(4).nuevoEstado).toBe("suspendido_indefinido");
  });

  it("5ta ocurrencia -> bloqueo permanente", () => {
    expect(consecuenciaNoPresentacion(5).nuevoEstado).toBe("bloqueado_permanente");
  });

  it("6ta ocurrencia o más también -> bloqueo permanente", () => {
    expect(consecuenciaNoPresentacion(8).nuevoEstado).toBe("bloqueado_permanente");
  });
});
