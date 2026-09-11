import { describe, expect, it } from "vitest";
import * as drivers from "./index";
import * as admin from "../services/admin";

const ESPERADAS = [
  "listarConductoresAdmin",
  "obtenerConductorAdmin",
  "actualizarConductorAdmin",
  "crearConductorAdmin",
  "listarConductoresAdminPaginados",
  "validarFormatoCurp",
  "listarSolicitudesConductorAdmin",
  "aprobarSolicitudConductorAdmin",
  "rechazarSolicitudConductorAdmin",
  "activarConductorAdmin",
  "obtenerMetricasRegistroConductor"
];

describe("contrato módulo drivers (Fase 6)", () => {
  it("expone su superficie", () => {
    for (const nombre of ESPERADAS) {
      expect((drivers as Record<string, unknown>)[nombre], nombre).toBeDefined();
    }
  });

  it("el facade re-exporta la misma referencia", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroMod = drivers as unknown as Record<string, unknown>;
    for (const nombre of ESPERADAS) {
      expect(registroAdmin[nombre], nombre).toBe(registroMod[nombre]);
    }
  });
});
