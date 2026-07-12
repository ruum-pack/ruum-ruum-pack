import { describe, expect, it } from "vitest";
import { MARCAS_CATALOGO, modelosPorMarca, tipoSugeridoParaVehiculo } from "./catalogo-vehiculos";

describe("catálogo de vehículos", () => {
  it("expone marcas únicas y modelos dependientes de la marca", () => {
    expect(new Set(MARCAS_CATALOGO).size).toBe(MARCAS_CATALOGO.length);
    expect(MARCAS_CATALOGO).toContain("Acura");
    expect(modelosPorMarca("Acura")).toContain("ADX");
    expect(modelosPorMarca("marca inexistente")).toEqual([]);
  });

  it("sugiere sedán para registros clasificados como automóvil", () => {
    expect(tipoSugeridoParaVehiculo("Acura", "ILX")).toBe("sedan");
  });

  it("distingue pick-up, van y SUV dentro de camiones ligeros", () => {
    expect(tipoSugeridoParaVehiculo("Nissan", "Frontier Diesel")).toBe("pick_up");
    expect(tipoSugeridoParaVehiculo("Toyota", "Hiace P")).toBe("van");
    expect(tipoSugeridoParaVehiculo("Acura", "Mdx")).toBe("suv");
  });

  it("no fuerza un tipo cuando marca y modelo no existen", () => {
    expect(tipoSugeridoParaVehiculo("Personalizada", "Prototipo")).toBeNull();
  });
});
