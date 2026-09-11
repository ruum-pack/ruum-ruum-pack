import { describe, expect, it } from "vitest";
import * as transfers from "./index";
import * as admin from "../services/admin";

const ESPERADAS = [
  "listarViajesAdmin",
  "listarViajesAdminPaginados",
  "listarCargasTrasladosMasivosAdmin",
  "obtenerTrazabilidadMasivaTraslado",
  "crearTrasladosMasivosAdmin",
  "procesarCargaTrasladosMasivosAdmin",
  "cancelarCargaTrasladosMasivosAdmin",
  "obtenerNotasInternas",
  "agregarNotaInterna",
  "asignarConductorAdmin",
  "ESTADOS_CRITICOS_TRASLADO",
  "cambiarEstatusAdmin",
  "marcarTrasladoFallido"
];

describe("contrato módulo transfers (Fase 6)", () => {
  it("expone su superficie", () => {
    for (const nombre of ESPERADAS) {
      expect((transfers as Record<string, unknown>)[nombre], nombre).toBeDefined();
    }
  });

  it("el facade re-exporta la misma referencia", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroMod = transfers as unknown as Record<string, unknown>;
    for (const nombre of ESPERADAS) {
      expect(registroAdmin[nombre], nombre).toBe(registroMod[nombre]);
    }
  });
});
