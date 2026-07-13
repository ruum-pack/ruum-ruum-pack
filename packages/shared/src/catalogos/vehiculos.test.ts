import { describe, expect, it } from "vitest";
import {
  CATALOGO_VEHICULOS,
  MARCAS_CATALOGO,
  METADATOS_CATALOGO_VEHICULOS,
  clasificacionesPorVehiculo,
  modelosPorMarca,
  resumenClasificacionVehiculo,
  tipoSugeridoParaVehiculo,
} from "./vehiculos";

describe("catálogo vehicular compartido", () => {
  it("conserva íntegramente el Excel convertido", () => {
    expect(METADATOS_CATALOGO_VEHICULOS.total).toBe(1365);
    expect(METADATOS_CATALOGO_VEHICULOS.sha256Fuente).toBe(
      "dcbe5e8df0275ba7d0771232f1a0cef82ac7013db238f35c1672c73a4b6444d3",
    );
    expect(CATALOGO_VEHICULOS).toHaveLength(1365);
    expect(CATALOGO_VEHICULOS.every((vehiculo) => Object.values(vehiculo).every(Boolean))).toBe(true);
  });

  it("expone 49 marcas y modelos sin duplicar opciones visibles", () => {
    expect(MARCAS_CATALOGO).toHaveLength(49);
    expect(new Set(MARCAS_CATALOGO).size).toBe(MARCAS_CATALOGO.length);
    expect(modelosPorMarca("ÁCURA")).toContain("ADX");
    expect(new Set(modelosPorMarca("Acura")).size).toBe(modelosPorMarca("Acura").length);
    expect(modelosPorMarca("marca inexistente")).toEqual([]);
  });

  it("prellena el tipo Ruum desde la clasificación corregida", () => {
    expect(tipoSugeridoParaVehiculo("Porsche", "Panamera")).toBe("luxury");
    expect(tipoSugeridoParaVehiculo("Nissan", "Frontier Diesel")).toBe("pick_up");
    expect(tipoSugeridoParaVehiculo("Honda", "Odyssey")).toBe("van");
    expect(tipoSugeridoParaVehiculo("Acura", "ADX")).toBe("suv");
  });

  it("no fuerza el tipo cuando el modelo no existe o su clasificación es ambigua", () => {
    expect(tipoSugeridoParaVehiculo("Personalizada", "Prototipo")).toBeNull();
    expect(clasificacionesPorVehiculo("Land Rover", "Range Rover").length).toBeGreaterThan(1);
    expect(tipoSugeridoParaVehiculo("Land Rover", "Range Rover")).toBeNull();
  });

  it("resume segmento, gama y categoría para las tres aplicaciones", () => {
    expect(resumenClasificacionVehiculo("Porsche", "Panamera")).toBe("De Lujo · Gama Alta · Ligero A");
    expect(resumenClasificacionVehiculo("Sin marca", "Sin modelo")).toBeNull();
  });
});
