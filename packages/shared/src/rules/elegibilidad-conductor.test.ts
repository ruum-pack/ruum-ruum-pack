import { describe, it, expect } from "vitest";
import {
  esElegibleParaViaje,
  nivelOperativoVigente,
  nivelPorExperienciaYCertificacion,
  vehiculosPermitidos,
  rutasPermitidas
} from "./elegibilidad-conductor";
import type { Conductor } from "../types/conductor";

function conductor(overrides: Partial<Conductor> = {}): Conductor {
  return {
    id: "c1",
    nombre: "Juan",
    estado: "activo",
    calificacion_promedio: 4.2,
    traslados_completados: 15,
    suspensiones_activas: 0,
    no_presentaciones_6m: 0,
    cancelaciones_sin_justificacion_count: 0,
    documentos_vigentes: true,
    certificaciones: [],
    incidencias_graves_6m: 0,
    incidencias_graves_12m: 0,
    creado_en: new Date().toISOString(),
    ...overrides
  };
}

describe("nivelPorExperienciaYCertificacion — PRD §4.3", () => {
  it("0 traslados y calificación 4.2 -> basico", () => {
    expect(nivelPorExperienciaYCertificacion(conductor({ traslados_completados: 0 }))).toBe("basico");
  });

  it("10 traslados y calificación 4.5 -> ejecutivo", () => {
    expect(
      nivelPorExperienciaYCertificacion(
        conductor({ traslados_completados: 10, calificacion_promedio: 4.5 })
      )
    ).toBe("ejecutivo");
  });

  it("ejecutivo con incidencia grave en los últimos 6 meses no alcanza ejecutivo", () => {
    expect(
      nivelPorExperienciaYCertificacion(
        conductor({ traslados_completados: 10, calificacion_promedio: 4.5, incidencias_graves_6m: 1 })
      )
    ).toBe("basico");
  });

  it("30 traslados y calificación 4.8 sin certificación luxury NO alcanza luxury", () => {
    expect(
      nivelPorExperienciaYCertificacion(
        conductor({ traslados_completados: 30, calificacion_promedio: 4.8 })
      )
    ).toBe("ejecutivo");
  });

  it("30 traslados, calificación 4.8 y certificación luxury vigente -> luxury", () => {
    expect(
      nivelPorExperienciaYCertificacion(
        conductor({
          traslados_completados: 30,
          calificacion_promedio: 4.8,
          incidencias_graves_6m: 0,
          incidencias_graves_12m: 0,
          certificaciones: [{ tipo: "vehiculos_luxury", vigente: true }]
        })
      )
    ).toBe("luxury");
  });

  it("50 traslados, calificación 4.9 y certificación colección -> coleccion", () => {
    expect(
      nivelPorExperienciaYCertificacion(
        conductor({
          traslados_completados: 50,
          calificacion_promedio: 4.9,
          certificaciones: [
            { tipo: "vehiculos_luxury", vigente: true },
            { tipo: "vehiculos_coleccion", vigente: true }
          ]
        })
      )
    ).toBe("coleccion");
  });
});

describe("nivelOperativoVigente — el menor entre experiencia y calificación (§4.3 + §4.13)", () => {
  it("experiencia ejecutivo, calificación basico (4.2) -> basico", () => {
    // calificacion_promedio 4.2 limita a nivelPorCalificacion=basico,
    // aunque traslados_completados alcance ejecutivo.
    expect(nivelOperativoVigente(conductor({ traslados_completados: 10, calificacion_promedio: 4.2 }))).toBe(
      "basico"
    );
  });

  it("calificación < 4.0 -> null (pierde elegibilidad)", () => {
    expect(nivelOperativoVigente(conductor({ calificacion_promedio: 3.8 }))).toBeNull();
  });
});

describe("vehiculosPermitidos / rutasPermitidas — PRD §4.3", () => {
  it("basico permite sedan y suv, ruta intraurbana", () => {
    expect(vehiculosPermitidos("basico")).toEqual(["sedan", "suv"]);
    expect(rutasPermitidas("basico")).toEqual(["intraurbana"]);
  });

  it("coleccion permite todos los tipos y todas las rutas", () => {
    expect(vehiculosPermitidos("coleccion")).toContain("coleccion");
    expect(rutasPermitidas("coleccion")).toContain("interurbana_mas_100km");
  });
});

describe("esElegibleParaViaje — PRD §4.3", () => {
  it("conductor activo, documentado y con nivel suficiente es elegible", () => {
    expect(esElegibleParaViaje(conductor(), "sedan", "intraurbana").elegible).toBe(true);
  });

  it("conductor suspendido no es elegible", () => {
    expect(esElegibleParaViaje(conductor({ estado: "suspendido_7d" }), "sedan", "intraurbana").elegible).toBe(
      false
    );
  });

  it("documentos vencidos no es elegible", () => {
    expect(esElegibleParaViaje(conductor({ documentos_vigentes: false }), "sedan", "intraurbana").elegible).toBe(
      false
    );
  });

  it("nivel basico no puede mover un vehículo luxury", () => {
    expect(esElegibleParaViaje(conductor(), "luxury", "intraurbana").elegible).toBe(false);
  });

  it("nivel basico no puede operar ruta interurbana", () => {
    expect(esElegibleParaViaje(conductor(), "sedan", "interurbana_menos_100km").elegible).toBe(false);
  });

  it("modo_prueba_supervisada cuenta como elegible para ver viajes (PRD §4.13)", () => {
    expect(
      esElegibleParaViaje(conductor({ estado: "modo_prueba_supervisada" }), "sedan", "intraurbana").elegible
    ).toBe(true);
  });
});
