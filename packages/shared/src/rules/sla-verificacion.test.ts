import { describe, it, expect } from "vitest";
import {
  slaVerificacionCuentaNueva,
  slaRevisionDocumentosUsuario,
  slaVerificacionConductorPrimeraVez,
  slaRevisionDocumentosConductor,
  dentroDePlazoCalificacion
} from "./sla-verificacion";

describe("SLAs de verificación — PRD §4.1", () => {
  it("verificación de cuenta nueva: límite 2 horas hábiles", () => {
    expect(slaVerificacionCuentaNueva(1.5).dentro_de_sla).toBe(true);
    expect(slaVerificacionCuentaNueva(2.5).dentro_de_sla).toBe(false);
  });

  it("revisión de documentos de usuario: límite 4 horas hábiles", () => {
    expect(slaRevisionDocumentosUsuario(3).dentro_de_sla).toBe(true);
    expect(slaRevisionDocumentosUsuario(5).dentro_de_sla).toBe(false);
  });

  it("verificación de conductor (primera vez): límite 24 horas hábiles", () => {
    expect(slaVerificacionConductorPrimeraVez(20).dentro_de_sla).toBe(true);
    expect(slaVerificacionConductorPrimeraVez(25).dentro_de_sla).toBe(false);
  });

  it("revisión de documentos de conductor: límite 24 horas hábiles", () => {
    expect(slaRevisionDocumentosConductor(23).dentro_de_sla).toBe(true);
    expect(slaRevisionDocumentosConductor(24).dentro_de_sla).toBe(true);
    expect(slaRevisionDocumentosConductor(24.5).dentro_de_sla).toBe(false);
  });

  it("alerta cuando se supera el 80% del SLA sin resolución (PRD §4.1)", () => {
    // 80% de 24h = 19.2h
    expect(slaRevisionDocumentosConductor(20).requiere_alerta).toBe(true);
    expect(slaRevisionDocumentosConductor(10).requiere_alerta).toBe(false);
  });
});

describe("dentroDePlazoCalificacion — PRD §4.13 (72 horas)", () => {
  it("dentro del plazo", () => expect(dentroDePlazoCalificacion(71)).toBe(true));
  it("fuera del plazo -> sistema registra 'sin calificación'", () => {
    expect(dentroDePlazoCalificacion(73)).toBe(false);
  });
});
