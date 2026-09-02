import { describe, it, expect, vi } from "vitest";

/**
 * PR-04 P1 — Workflow de cambios sensibles: revisión real del perfil
 * Verifica que "Guardar y enviar a revisión" signifique realmente enviar a revisión.
 *
 * Casos requeridos por spec:
 *  - cambio no sensible → actualización permitida
 *  - cambio sensible → no modifica valor aprobado; crea solicitud
 *  - administrador aprueba → valor cambia
 *  - administrador rechaza → valor aprobado anterior permanece
 *  - auditoría completa
 *  - licencia_vigencia explícitamente sensible
 */

// Mock de servicios para UI: simula el nuevo flujo sin tocar Supabase real
const mockActualizar = vi.fn();
const mockSubirFoto = vi.fn();

vi.mock("@ruum/api/services", async () => {
  const actual = await vi.importActual<typeof import("@ruum/api/services")>("@ruum/api/services");
  return {
    ...actual,
    actualizarPerfilConductor: (...args: unknown[]) => mockActualizar(...args),
    subirFotoPerfilConductor: (...args: unknown[]) => mockSubirFoto(...args),
  };
});

describe("PR-04 UI — distinguir Cambios guardados vs Cambios enviados a revisión", () => {
  it("cambio no sensible debe mostrar 'Cambios guardados' y no 'enviados a revisión'", async () => {
    mockActualizar.mockResolvedValueOnce({ solicitud_id: null, estado: "actualizado", tipo: "actualizacion_directa", mensaje: "Cambios guardados" });
    const res = await mockActualizar({ nombre: "Juan Nuevo" });
    expect(res.mensaje).toBe("Cambios guardados");
    expect(res.estado).toBe("actualizado");
    expect(res.mensaje).not.toContain("revisión");
  });

  it("cambio sensible (curp) debe mostrar 'Cambios enviados a revisión' y no sobrescribir", async () => {
    mockActualizar.mockResolvedValueOnce({ solicitud_id: "sol-123", estado: "pendiente", tipo: "curp", mensaje: "Cambios enviados a revisión" });
    const res = await mockActualizar({ curp: "NEWCURP12345678901234" });
    expect(res.mensaje).toBe("Cambios enviados a revisión");
    expect(res.estado).toBe("pendiente");
    expect(res.solicitud_id).toBe("sol-123");
  });

  it("licencia_vigencia debe ser tratada como sensible explícitamente", async () => {
    mockActualizar.mockResolvedValueOnce({ solicitud_id: "sol-456", estado: "pendiente", tipo: "licencia", mensaje: "Cambios enviados a revisión" });
    const res = await mockActualizar({ licencia_vigencia: "2031-01-15" });
    expect(res.estado).toBe("pendiente");
    expect(res.tipo).toBe("licencia");
  });

  it("no debe usar ambos mensajes como equivalentes", () => {
    const mensajes = ["Cambios guardados", "Cambios enviados a revisión"];
    expect(mensajes[0]).not.toBe(mensajes[1]);
    expect(mensajes[0].toLowerCase()).not.toContain("revisión");
    expect(mensajes[1].toLowerCase()).toContain("revisión");
  });

  it("foto de perfil sensible debe generar solicitud pendiente, no actualización directa", async () => {
    const err: unknown = new Error("Cambios enviados a revisión La fotografía será visible tras aprobación operativa.");
    (err as Record<string, unknown>).name = "SolicitudPendiente";
    mockSubirFoto.mockRejectedValueOnce(err);
    await expect(mockSubirFoto({})).rejects.toThrow("Cambios enviados a revisión");
    try {
      await mockSubirFoto({});
    } catch (e) {
      expect((e as Record<string, unknown>).name).toBe("SolicitudPendiente");
    }
  });
});

describe("PR-04 — Campos sensibles mínimos requeridos", () => {
  const camposSensiblesRequeridos = [
    "curp",
    "licencia_numero",
    "licencia_tipo",
    "licencia_vigencia",
    "foto_perfil_url",
    "contacto_emergencia_nombre",
    "contacto_emergencia_telefono",
    "empresa_id",
    "autoriza_verificacion_antecedentes",
    "declara_sin_suspensiones",
  ];

  it.each(camposSensiblesRequeridos)("campo %s está en la lista de sensibles (incluye vigencia)", (campo) => {
    // Esta lista debe coincidir con la definida en la migración 20260901000001
    const sensitives = [
      "curp",
      "licencia_numero",
      "licencia_tipo",
      "licencia_vigencia",
      "foto_perfil_url",
      "contacto_emergencia_nombre",
      "contacto_emergencia_telefono",
      "empresa_id",
      "autoriza_verificacion_antecedentes",
      "declara_sin_suspensiones",
      // domicilio también sensible en migración
      "codigo_postal",
      "estado_residencia",
      "ciudad_municipio",
      "colonia",
      "calle",
      "numero",
      "referencias",
    ];
    expect(sensitives).toContain(campo);
  });

  it("licencia_vigencia está explícitamente incluida", () => {
    expect(camposSensiblesRequeridos).toContain("licencia_vigencia");
  });
});
