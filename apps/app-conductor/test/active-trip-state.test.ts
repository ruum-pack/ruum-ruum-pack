import { describe, expect, it } from "vitest";

import {
  normalizarViajeActivo,
  viajeEsOperacionActiva,
  viajePermiteEmergencia,
  viajePermiteSeguimientoUbicacion
} from "../src/app/active-trip-state";

describe("active trip state", () => {
  it("identifica estados operativos con emergencia disponible", () => {
    expect(viajeEsOperacionActiva("traslado_en_curso")).toBe(true);
    expect(viajePermiteEmergencia("traslado_en_curso")).toBe(true);
    expect(viajePermiteSeguimientoUbicacion("traslado_en_curso")).toBe(true);
  });

  it("excluye estados fuera de operacion activa", () => {
    expect(viajeEsOperacionActiva("servicio_cerrado")).toBe(false);
    expect(viajePermiteEmergencia("servicio_cerrado")).toBe(false);
    expect(viajePermiteSeguimientoUbicacion("conductor_asignado")).toBe(false);
  });

  it("normaliza folio, etapa y destino operativo desde direcciones", () => {
    expect(
      normalizarViajeActivo({
        trasladoId: "12345678-aaaa-bbbb-cccc-123456789000",
        estado: "traslado_en_curso",
        origenDireccion: "Origen",
        origenCiudad: "CDMX",
        destinoDireccion: "Destino",
        destinoCiudad: "Toluca"
      })
    ).toMatchObject({
      trasladoId: "12345678-aaaa-bbbb-cccc-123456789000",
      estado: "traslado_en_curso",
      folio: "12345678",
      etapa: "Dirígete al punto de entrega",
      destinoActual: "Destino · Toluca"
    });
  });
});
