import { describe, it, expect } from "vitest";
import { puedeAbrirseDisputa, slaRevisionAdmin, slaResolucionDisputa, puedeEscalarse } from "./sla-disputas";

describe("puedeAbrirseDisputa — PRD §4.14 (72 horas post-cierre)", () => {
  it("dentro de las 72 horas", () => expect(puedeAbrirseDisputa(71)).toBe(true));
  it("exactamente en el límite", () => expect(puedeAbrirseDisputa(72)).toBe(true));
  it("fuera del plazo", () => expect(puedeAbrirseDisputa(73)).toBe(false));
});

describe("slaRevisionAdmin — PRD §4.14 (48 horas)", () => {
  it("dentro del SLA", () => expect(slaRevisionAdmin(10).dentro_de_sla).toBe(true));
  it("requiere alerta al superar 80% (PRD §4.1)", () => {
    const r = slaRevisionAdmin(40); // 40/48 = 83%
    expect(r.requiere_alerta).toBe(true);
    expect(r.dentro_de_sla).toBe(true);
  });
  it("fuera del SLA", () => expect(slaRevisionAdmin(50).dentro_de_sla).toBe(false));
});

describe("slaResolucionDisputa — PRD §4.14 (5 días hábiles estándar, 10 si escala)", () => {
  it("estándar dentro de 5 días hábiles", () => expect(slaResolucionDisputa(4, false).dentro_de_sla).toBe(true));
  it("estándar fuera de 5 días hábiles", () => expect(slaResolucionDisputa(6, false).dentro_de_sla).toBe(false));
  it("escalada dentro de 10 días hábiles", () => expect(slaResolucionDisputa(9, true).dentro_de_sla).toBe(true));
  it("escalada fuera de 10 días hábiles", () => expect(slaResolucionDisputa(11, true).dentro_de_sla).toBe(false));
});

describe("puedeEscalarse — PRD §4.14 (48 horas tras resolución)", () => {
  it("dentro del plazo de escalamiento", () => expect(puedeEscalarse(40)).toBe(true));
  it("fuera del plazo de escalamiento", () => expect(puedeEscalarse(49)).toBe(false));
});
