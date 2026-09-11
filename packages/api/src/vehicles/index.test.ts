import { describe, expect, it } from "vitest";
import * as vehicles from "./index";
import * as admin from "../services/admin";

const ESPERADAS = [
  "obtenerVehiculoAdmin",
  "crearVehiculoAdmin",
  "actualizarVehiculoAdmin",
  "validarDominioVehiculoAdmin",
  "listarVehiculosAdmin",
  "listarVehiculosAdminPaginados",
  "suspenderVehiculoAdmin",
  "obtenerHistorialVehiculoAdmin",
  "obtenerViajesDeVehiculoAdmin"
];

describe("contrato módulo vehicles (Fase 6)", () => {
  it("expone su superficie", () => {
    for (const nombre of ESPERADAS) {
      expect((vehicles as Record<string, unknown>)[nombre], nombre).toBeDefined();
    }
  });

  it("el facade re-exporta la misma referencia", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroMod = vehicles as unknown as Record<string, unknown>;
    for (const nombre of ESPERADAS) {
      expect(registroAdmin[nombre], nombre).toBe(registroMod[nombre]);
    }
  });
});
