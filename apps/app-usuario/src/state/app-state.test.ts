import { describe, expect, it } from "vitest";
import {
  crearEstadoNuevoTrasladoInicial,
  nuevoTrasladoReducer,
  realtimeTrasladosReducer,
  type RealtimeTrasladosState
} from "./app-state";

describe("app-usuario — estado centralizado", () => {
  it("actualiza un campo sin perder el resto del formulario", () => {
    const inicial = crearEstadoNuevoTrasladoInicial();
    const conMarca = nuevoTrasladoReducer(inicial, { type: "set", key: "datos", value: { ...inicial.datos, marca: "Toyota" } });

    expect(conMarca.datos.marca).toBe("Toyota");
    expect(conMarca.datos.modelo).toBe("");
    expect(conMarca.paso).toBe(inicial.paso);
    expect(conMarca.errores).toEqual(inicial.errores);
  });

  it("acepta actualizaciones funcionales, igual que un setter de React", () => {
    const inicial = crearEstadoNuevoTrasladoInicial();
    const siguiente = nuevoTrasladoReducer(inicial, { type: "set", key: "reintentoAceptacion", value: (n: unknown) => Number(n) + 1 });

    expect(siguiente.reintentoAceptacion).toBe(1);
  });

  it("mantiene aislado el estado Realtime por traslado", () => {
    let estado: RealtimeTrasladosState = {};
    estado = realtimeTrasladosReducer(estado, { type: "init", trasladoId: "t-1", ubicacionInicial: null });
    estado = realtimeTrasladosReducer(estado, { type: "init", trasladoId: "t-2", ubicacionInicial: null });
    estado = realtimeTrasladosReducer(estado, {
      type: "patch",
      trasladoId: "t-1",
      patch: { estadoRealtime: "traslado_en_curso" }
    });

    expect(estado["t-1"]?.estadoRealtime).toBe("traslado_en_curso");
    expect(estado["t-2"]?.estadoRealtime).toBeNull();

    estado = realtimeTrasladosReducer(estado, { type: "patch", trasladoId: "t-1", patch: { pagoConfirmado: true } });
    expect(estado["t-1"]?.pagoConfirmado).toBe(true);
    expect(estado["t-2"]?.pagoConfirmado).toBe(false);
  });

  it("deduplica el mismo mensaje cuando llega por carga inicial y Realtime", () => {
    const mensaje = {
      id: "m-1",
      remitente: "conductor" as const,
      contenido: "Ya voy en camino",
      enviado_en: "2026-09-03T12:00:00.000Z"
    };
    let estado: RealtimeTrasladosState = {};
    estado = realtimeTrasladosReducer(estado, { type: "messages", trasladoId: "t-1", mensajes: [mensaje] });
    const mismoEstado = realtimeTrasladosReducer(estado, { type: "message", trasladoId: "t-1", mensaje });

    expect(mismoEstado).toBe(estado);
    expect(mismoEstado["t-1"]?.mensajes).toHaveLength(1);
  });

  it("conserva un mensaje Realtime que llega antes del historial inicial", () => {
    const enVivo = {
      id: "m-2",
      remitente: "conductor" as const,
      contenido: "Ya llegué",
      enviado_en: "2026-09-03T12:02:00.000Z"
    };
    const historico = {
      id: "m-1",
      remitente: "usuario" as const,
      contenido: "Te espero",
      enviado_en: "2026-09-03T12:01:00.000Z"
    };
    let estado: RealtimeTrasladosState = {};
    estado = realtimeTrasladosReducer(estado, { type: "message", trasladoId: "t-1", mensaje: enVivo });
    estado = realtimeTrasladosReducer(estado, { type: "messages", trasladoId: "t-1", mensajes: [historico] });

    expect(estado["t-1"]?.mensajes.map((mensaje) => mensaje.id)).toEqual(["m-1", "m-2"]);
  });
});
