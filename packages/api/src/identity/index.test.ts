import { describe, expect, it } from "vitest";
import * as identity from "./index";
import * as admin from "../services/admin";

const ESPERADAS = [
  "obtenerAdminActual",
  "obtenerUsuarioAdmin",
  "actualizarUsuarioAdmin",
  "invitarUsuarioAdmin",
  "listarUsuariosAdmin",
  "listarUsuariosAdminPaginados",
  "listarSesionesUsuario",
  "revocarSesionUsuario",
  "listarPagosDeUsuario",
  "listarIncidenciasDeUsuario",
  "listarEmpresasDeUsuario"
];

describe("contrato módulo identity (Fase 6)", () => {
  it("expone su superficie", () => {
    for (const nombre of ESPERADAS) {
      expect((identity as Record<string, unknown>)[nombre], nombre).toBeDefined();
    }
  });

  it("el facade re-exporta la misma referencia", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroMod = identity as unknown as Record<string, unknown>;
    for (const nombre of ESPERADAS) {
      expect(registroAdmin[nombre], nombre).toBe(registroMod[nombre]);
    }
  });
});
