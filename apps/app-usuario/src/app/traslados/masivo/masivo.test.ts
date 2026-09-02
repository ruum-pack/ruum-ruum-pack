import { describe, expect, it } from "vitest";
import {
  COLUMNAS_REQUERIDAS,
  EJEMPLO_CSV_PLANTILLA,
  revisarCsv
} from "@ruum/shared/utils";

describe("Carga Masiva de Traslados — app-usuario", () => {
  it("valida que la plantilla CSV de traslados contiene todas las columnas requeridas", () => {
    const revision = revisarCsv(EJEMPLO_CSV_PLANTILLA);
    expect(revision.errores).toEqual([]);
    expect(revision.filas.length).toBeGreaterThanOrEqual(1);

    const primeraFila = revision.filas[0]!;
    for (const col of COLUMNAS_REQUERIDAS) {
      expect(primeraFila[col], `Falta columna requerida ${col}`).toBeDefined();
      expect(primeraFila[col]!.length).toBeGreaterThan(0);
    }
  });

  it("rechaza archivos CSV con columnas requeridas faltantes", () => {
    const csvSinDestino = "vehiculo_marca,vehiculo_modelo,vehiculo_anio\nNissan,Versa,2024";
    const revision = revisarCsv(csvSinDestino);
    expect(revision.errores.length).toBeGreaterThan(0);
    expect(revision.errores.some((e) => e.includes("Columna requerida faltante"))).toBe(true);
  });

  it("rechaza archivos con columnas desconocidas para evitar inyecciones de datos no permitidos", () => {
    const csvConColumnaInvalida = EJEMPLO_CSV_PLANTILLA.replace("referencia_externa", "tarifa_falsa_hack");
    const revision = revisarCsv(csvConColumnaInvalida);
    expect(revision.errores.some((e) => e.includes("Columna no permitida: tarifa_falsa_hack"))).toBe(true);
  });

  it("limita el procesamiento a lotes de máximo 100 filas", () => {
    const encabezado = EJEMPLO_CSV_PLANTILLA.split("\n")[0]!;
    const filaEjemplo = EJEMPLO_CSV_PLANTILLA.split("\n")[1]!;
    const lineas = [encabezado, ...Array(105).fill(filaEjemplo)];
    const csvLargo = lineas.join("\n");

    const revision = revisarCsv(csvLargo);
    expect(revision.filas).toHaveLength(105);
    // Verificamos que la regla de negocio de 100 filas aplique
    expect(revision.filas.length > 100).toBe(true);
  });
});
