import { describe, expect, it } from "vitest";
import * as operations from "./index";
import * as admin from "../services/admin";

const FUNCIONES_ESPERADAS = [
  "obtenerMetricasDashboard",
  "obtenerIndicadoresAccionablesDashboard",
  "listarAuditoriaOperativaTraslados",
  "ejecutarAccionMasiva",
  "listarTrasladosActivosMapa",
  "listarExcepcionesCriticasAdmin",
  "actualizarAlertaSlaAdmin",
  "listarAlertasSLA"
];

// Helpers internos del módulo: existen aquí pero nunca fueron API pública
// (eran privados de services/admin.ts), así que el facade no los re-exporta.
const SOLO_MODULO = [
  "withIdempotentRetry",
  "objetoMetrica",
  "numeroMetrica",
  "numeroMetricaNullable"
];

describe("facade admin -> operations (Fase 5)", () => {
  it("expone las funciones del dominio", () => {
    for (const nombre of FUNCIONES_ESPERADAS) {
      expect(typeof (operations as Record<string, unknown>)[nombre], nombre).toBe("function");
    }
  });

  it("el facade re-exporta la misma referencia (compatibilidad total)", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroOps = operations as unknown as Record<string, unknown>;
    for (const nombre of FUNCIONES_ESPERADAS) {
      expect(registroAdmin[nombre], nombre).toBe(registroOps[nombre]);
    }
  });

  it("los helpers internos no se fugan al facade", () => {
    const registroAdmin = admin as unknown as Record<string, unknown>;
    const registroOps = operations as unknown as Record<string, unknown>;
    for (const nombre of SOLO_MODULO) {
      expect(typeof registroOps[nombre], nombre).toBe("function");
      expect(registroAdmin[nombre], nombre).toBeUndefined();
    }
  });
});
