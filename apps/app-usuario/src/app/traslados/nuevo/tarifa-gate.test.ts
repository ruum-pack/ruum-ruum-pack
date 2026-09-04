import { describe, it, expect } from "vitest";
import { CAMPOS_PASO_TARIFA, codigoPostalCompleto, generarTarifaSnapshot, haCambiadoTarifa } from "./tarifa-gate";
import type { DatosFormulario } from "./types";

describe("tarifa-gate — invalidación y snapshot de tarifa previa", () => {
  const base: Partial<DatosFormulario> = {
    origenCodigoPostal: "03100",
    destinoCodigoPostal: "06600",
    marca: "Nissan",
    modelo: "Versa",
    condicion: "seminueva",
    modalidadProgramacion: "lo_antes_posible",
    fechaHoraProgramada: "",
    color: "blanco",
    placas: "ABC-123",
    entregaNombre: "Carlos",
    tipoServicio: "personal"
  };

  it("define exactamente los 7 campos que impactan precio en CAMPOS_PASO_TARIFA", () => {
    expect(Array.from(CAMPOS_PASO_TARIFA).sort()).toEqual([
      "condicion",
      "destinoCodigoPostal",
      "fechaHoraProgramada",
      "marca",
      "modalidadProgramacion",
      "modelo",
      "origenCodigoPostal"
    ]);
  });

  it("genera snapshot idéntico independientemente de espacios en blanco", () => {
    const s1 = generarTarifaSnapshot(base);
    const s2 = generarTarifaSnapshot({
      ...base,
      marca: "  Nissan  ",
      modelo: " Versa ",
      origenCodigoPostal: "03100 "
    });
    expect(s1).toBe(s2);
  });

  it("detecta cambio al modificar cualquiera de los 7 campos de tarifa", () => {
    const snapshot = generarTarifaSnapshot(base);

    expect(haCambiadoTarifa(snapshot, { ...base, marca: "Toyota" })).toBe(true);
    expect(haCambiadoTarifa(snapshot, { ...base, modelo: "Sentra" })).toBe(true);
    expect(haCambiadoTarifa(snapshot, { ...base, condicion: "nueva" })).toBe(true);
    expect(haCambiadoTarifa(snapshot, { ...base, origenCodigoPostal: "03200" })).toBe(true);
    expect(haCambiadoTarifa(snapshot, { ...base, destinoCodigoPostal: "44100" })).toBe(true);
    expect(haCambiadoTarifa(snapshot, { ...base, modalidadProgramacion: "programado", fechaHoraProgramada: "2026-09-05T10:00" })).toBe(true);
  });

  it("NO invalida tarifa al modificar campos que no afectan el precio", () => {
    const snapshot = generarTarifaSnapshot(base);

    expect(haCambiadoTarifa(snapshot, { ...base, color: "rojo" })).toBe(false);
    expect(haCambiadoTarifa(snapshot, { ...base, placas: "XYZ-999" })).toBe(false);
    expect(haCambiadoTarifa(snapshot, { ...base, entregaNombre: "Roberto" })).toBe(false);
    expect(haCambiadoTarifa(snapshot, { ...base, tipoServicio: "empresarial" })).toBe(false);
    expect(haCambiadoTarifa(snapshot, { ...base, anio: "2024" })).toBe(false);
  });

  it("retorna false si no hay snapshot previo", () => {
    expect(haCambiadoTarifa(null, base)).toBe(false);
  });

  it("solo considera finalizado un código postal mexicano de 5 dígitos", () => {
    expect(codigoPostalCompleto("03100")).toBe(true);
    expect(codigoPostalCompleto(" 06600 ")).toBe(true);
    expect(codigoPostalCompleto("0660")).toBe(false);
    expect(codigoPostalCompleto("0660a")).toBe(false);
    expect(codigoPostalCompleto("")).toBe(false);
  });

  it("permite verificar que la tarifa previa deja de ser válida tras editar campos de precio (UX 1)", () => {
    let tarifaPreviaAceptada = true;
    const snapshotInicial = generarTarifaSnapshot(base);

    // Si el usuario edita el color, no se invalida la tarifa aceptada
    const edicionColor = { ...base, color: "negro" };
    if (haCambiadoTarifa(snapshotInicial, edicionColor)) {
      tarifaPreviaAceptada = false;
    }
    expect(tarifaPreviaAceptada).toBe(true);

    // Si el usuario edita la marca o modelo en paso 1, la tarifa previa queda invalidada
    const edicionMarca = { ...base, marca: "Honda", modelo: "Civic" };
    if (haCambiadoTarifa(snapshotInicial, edicionMarca)) {
      tarifaPreviaAceptada = false;
    }
    expect(tarifaPreviaAceptada).toBe(false);
  });
});
