import { describe, expect, it, vi } from "vitest";
import {
  listarConsentimientosSolicitud,
  listarDocumentosSolicitud,
  obtenerBorradorSolicitud
} from "./mi-solicitud";

describe("drivers mi-solicitud (Fase 6)", () => {
  it("obtiene el borrador o null", async () => {
    const fila = { paso_actual: 2 };
    const maybeSingle = vi.fn().mockResolvedValue({ data: fila, error: null });
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) })
      })
    };
    await expect(obtenerBorradorSolicitud(cliente as never, "s")).resolves.toEqual(fila);
    expect(cliente.from).toHaveBeenCalledWith("solicitudes_conductor");
  });

  it("lanza si la lectura falla", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error("db") });
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) })
      })
    };
    await expect(obtenerBorradorSolicitud(cliente as never, "s")).rejects.toThrow("db");
  });

  it("lista documentos y consentimientos", async () => {
    const docs = [{ tipo: "licencia_frente", estado: "aprobado", es_actual: true }];
    const cons = [{ tipo_documento: "aviso", aceptado_en: "2026-01-01" }];
    const clienteDocs = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: docs, error: null }) })
        })
      })
    };
    await expect(listarDocumentosSolicitud(clienteDocs as never, "s")).resolves.toEqual(docs);
    const clienteCons = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: cons, error: null })
        })
      })
    };
    await expect(listarConsentimientosSolicitud(clienteCons as never, "s")).resolves.toEqual(cons);
  });

  it("consentimientos propaga error", async () => {
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error("db") })
        })
      })
    };
    await expect(listarConsentimientosSolicitud(cliente as never, "s")).rejects.toThrow("db");
  });
});
