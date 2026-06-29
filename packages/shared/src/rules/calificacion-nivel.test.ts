import { describe, it, expect } from "vitest";
import { nivelPorCalificacion, calcularCalificacionPromedio } from "./calificacion-nivel";
import type { CalificacionTraslado } from "../types/conductor";

describe("nivelPorCalificacion — PRD §4.13", () => {
  it("3.9 -> null (pierde elegibilidad)", () => expect(nivelPorCalificacion(3.9)).toBeNull());
  it("4.0 -> basico", () => expect(nivelPorCalificacion(4.0)).toBe("basico"));
  it("4.49 -> basico", () => expect(nivelPorCalificacion(4.49)).toBe("basico"));
  it("4.5 -> ejecutivo", () => expect(nivelPorCalificacion(4.5)).toBe("ejecutivo"));
  it("4.79 -> ejecutivo", () => expect(nivelPorCalificacion(4.79)).toBe("ejecutivo"));
  it("4.8 -> luxury", () => expect(nivelPorCalificacion(4.8)).toBe("luxury"));
  it("4.89 -> luxury", () => expect(nivelPorCalificacion(4.89)).toBe("luxury"));
  it("4.9 -> coleccion", () => expect(nivelPorCalificacion(4.9)).toBe("coleccion"));
  it("5.0 -> coleccion", () => expect(nivelPorCalificacion(5.0)).toBe("coleccion"));
});

function calRecienteHace(dias: number, estrellas: number): CalificacionTraslado {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return { traslado_id: `t-${dias}`, conductor_id: "c1", estrellas, calificado_en: fecha.toISOString() };
}

describe("calcularCalificacionPromedio — PRD §4.13", () => {
  it("promedia solo las calificaciones dentro de los últimos 6 meses", () => {
    const calificaciones = [
      calRecienteHace(10, 5),
      calRecienteHace(20, 5),
      calRecienteHace(400, 1) // fuera de la ventana de 6 meses (~182 días)
    ];
    expect(calcularCalificacionPromedio(calificaciones)).toBe(5);
  });

  it("sin calificaciones en la ventana retorna 5.0 (arranca al máximo, no penaliza falta de datos)", () => {
    expect(calcularCalificacionPromedio([calRecienteHace(400, 5)])).toBe(5);
  });

  it("limita a los 100 más recientes dentro de la ventana", () => {
    const muchas: CalificacionTraslado[] = [];
    for (let i = 0; i < 150; i++) {
      // 100 más recientes con 5 estrellas, 50 más antiguas (pero aún dentro
      // de los 6 meses) con 1 estrella — el promedio debe ignorar las 50 antiguas.
      muchas.push(calRecienteHace(i, i < 100 ? 5 : 1));
    }
    expect(calcularCalificacionPromedio(muchas)).toBe(5);
  });

  it("calcula correctamente un promedio mixto", () => {
    const calificaciones = [calRecienteHace(1, 5), calRecienteHace(2, 4), calRecienteHace(3, 3)];
    expect(calcularCalificacionPromedio(calificaciones)).toBe(4);
  });
});
