import { describe, expect, it } from "vitest";
import {
  EJEMPLO_CSV_PLANTILLA,
  normalizarEncabezado,
  revisarCsv,
  separarCsv
} from "./csv-masivos";

describe("csv-masivos shared utils", () => {
  it("normaliza encabezados correctamente", () => {
    expect(normalizarEncabezado("  Vehiculo Marca ")).toBe("vehiculo_marca");
    expect(normalizarEncabezado("DESTINO CODIGO POSTAL")).toBe("destino_codigo_postal");
  });

  it("separa celdas considerando comas y comillas", () => {
    const linea = 'Nissan,Versa,"Av. Reforma, 100",2024';
    expect(separarCsv(linea, ",")).toEqual([
      "Nissan",
      "Versa",
      "Av. Reforma, 100",
      "2024"
    ]);
  });

  it("separa celdas con punto y coma", () => {
    const linea = "Nissan;Versa;06700";
    expect(separarCsv(linea, ";")).toEqual(["Nissan", "Versa", "06700"]);
  });

  it("valida exitosamente la plantilla CSV de ejemplo", () => {
    const revision = revisarCsv(EJEMPLO_CSV_PLANTILLA);
    expect(revision.errores).toHaveLength(0);
    expect(revision.filas).toHaveLength(1);
    expect(revision.filas[0]?.vehiculo_marca).toBe("Nissan");
    expect(revision.filas[0]?.vehiculo_modelo).toBe("Versa");
  });

  it("detecta columnas requeridas faltantes", () => {
    const csvIncompleto = "referencia_externa,vehiculo_marca\nLOTE-1,Nissan";
    const revision = revisarCsv(csvIncompleto);
    expect(revision.errores.some((e) => e.includes("Columna requerida faltante"))).toBe(true);
  });

  it("detecta columnas no permitidas", () => {
    const csvInvalido = EJEMPLO_CSV_PLANTILLA.replace("referencia_externa", "columna_desconocida");
    const revision = revisarCsv(csvInvalido);
    expect(revision.errores.some((e) => e.includes("Columna no permitida: columna_desconocida"))).toBe(true);
  });
});
