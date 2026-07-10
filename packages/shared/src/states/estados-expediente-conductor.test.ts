import { describe, expect, it } from "vitest";
import {
  ESTADOS_DOCUMENTO_CONDUCTOR,
  ESTADOS_EXPEDIENTE_CONDUCTOR,
  TRANSICIONES_DOCUMENTO_CONDUCTOR,
  TRANSICIONES_EXPEDIENTE_CONDUCTOR,
  puedeTransicionarDocumentoConductor,
  puedeTransicionarExpedienteConductor
} from "./estados-expediente-conductor";

describe("máquina de estados del expediente del conductor", () => {
  it("define una entrada de transiciones para cada estado", () => {
    expect(Object.keys(TRANSICIONES_EXPEDIENTE_CONDUCTOR).sort()).toEqual(
      [...ESTADOS_EXPEDIENTE_CONDUCTOR].sort()
    );
  });

  it("permite el flujo normal hasta aprobación", () => {
    const flujo = [
      "borrador",
      "correo_pendiente",
      "documentos_pendientes",
      "listo_para_enviar",
      "en_revision",
      "aprobado"
    ] as const;

    for (let indice = 0; indice < flujo.length - 1; indice += 1) {
      expect(puedeTransicionarExpedienteConductor(flujo[indice], flujo[indice + 1])).toBe(true);
    }
  });

  it("impide autoaprobar un expediente incompleto", () => {
    expect(puedeTransicionarExpedienteConductor("documentos_pendientes", "aprobado")).toBe(false);
  });

  it("considera rechazo terminal y permite reactivar una suspensión", () => {
    expect(TRANSICIONES_EXPEDIENTE_CONDUCTOR.rechazado).toEqual([]);
    expect(puedeTransicionarExpedienteConductor("suspendido", "aprobado")).toBe(true);
  });
});

describe("máquina de estados de documentos", () => {
  it("define una entrada de transiciones para cada estado", () => {
    expect(Object.keys(TRANSICIONES_DOCUMENTO_CONDUCTOR).sort()).toEqual(
      [...ESTADOS_DOCUMENTO_CONDUCTOR].sort()
    );
  });

  it("un documento sustituido es inmutable", () => {
    expect(TRANSICIONES_DOCUMENTO_CONDUCTOR.reemplazado).toEqual([]);
  });

  it("un rechazo se corrige creando un reemplazo, no autoaprobándolo", () => {
    expect(puedeTransicionarDocumentoConductor("rechazado", "reemplazado")).toBe(true);
    expect(puedeTransicionarDocumentoConductor("rechazado", "aprobado")).toBe(false);
  });
});
