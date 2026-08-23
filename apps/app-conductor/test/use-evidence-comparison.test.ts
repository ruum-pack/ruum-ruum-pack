import { describe, expect, it } from "vitest";
import { calcularComparacion } from "../src/app/viajes/[id]/evidencia/useEvidenceComparison";

describe("Comparación de Evidencia Inicial vs Final (useEvidenceComparison)", () => {
  it("detecta inconsistencia cuando el kilometraje final es menor al inicial", () => {
    const inicial = {
      combustible: "1/2",
      kilometraje: "50000",
      llavesRecibidas: "2",
      hologramaVerificacion: "si",
      talonVerificacion: "si",
      tarjetaCirculacion: "si",
      placaDelantera: "ABC-123",
      placaTrasera: "ABC-123",
      notas: ""
    };
    const final = {
      combustible: "1/2",
      kilometraje: "49500", // Menor que 50000
      llavesRecibidas: "2",
      hologramaVerificacion: "si",
      talonVerificacion: "si",
      tarjetaCirculacion: "si",
      placaDelantera: "ABC-123",
      placaTrasera: "ABC-123",
      notas: ""
    };

    const resultado = calcularComparacion(inicial, final);
    expect(resultado.kilometraje.valido).toBe(false);
    expect(resultado.kilometraje.diferencia).toBe(-500);
    expect(resultado.alertas).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: "critico" })])
    );
  });

  it("detecta faltante de llaves y documentos", () => {
    const inicial = {
      combustible: "1/1",
      kilometraje: "10000",
      llavesRecibidas: "2",
      hologramaVerificacion: "si",
      talonVerificacion: "si",
      tarjetaCirculacion: "si",
      placaDelantera: "XYZ-789",
      placaTrasera: "XYZ-789",
      notas: ""
    };
    const final = {
      combustible: "1/4", // Combustible menor
      kilometraje: "10250",
      llavesRecibidas: "1", // Faltan llaves
      hologramaVerificacion: "si",
      talonVerificacion: "no", // Falta talón
      tarjetaCirculacion: "si",
      placaDelantera: "XYZ-789",
      placaTrasera: "XYZ-789",
      notas: ""
    };

    const resultado = calcularComparacion(inicial, final);
    expect(resultado.kilometraje.valido).toBe(true);
    expect(resultado.kilometraje.diferencia).toBe(250);
    expect(resultado.llaves.coincide).toBe(false);
    expect(resultado.documentos.faltantes).toContain("Talón de verificación");
  });
});
