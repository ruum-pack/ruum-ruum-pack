import { describe, expect, it } from "vitest";
import * as organizations from "./index";
import * as admin from "../services/admin";

const ESPERADAS = [
  "listarEmpresasAdmin",
  "crearEmpresaCorporativaAdmin",
  "actualizarEmpresaCorporativaAdmin",
  "cambiarEstadoEmpresaAdmin",
  "guardarUsuarioEmpresaAdmin",
  "resolverCambioEmpresaAdmin"
];

describe("contrato módulo organizations (Fase 6)", () => {
  it("expone su superficie", () => {
    for (const nombre of ESPERADAS) {
      expect((organizations as Record<string, unknown>)[nombre], nombre).toBeDefined();
    }
  });

  it("el facade re-exporta la misma referencia", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroMod = organizations as unknown as Record<string, unknown>;
    for (const nombre of ESPERADAS) {
      expect(registroAdmin[nombre], nombre).toBe(registroMod[nombre]);
    }
  });
});
