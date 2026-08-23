import { beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear()
};

Object.defineProperty(globalThis, "window", {
  value: {
    localStorage: localStorageMock
  },
  writable: true
});

import {
  guardarBorradorRegistroLocal,
  leerBorradorRegistroLocal,
  limpiarBorradorRegistroLocal
} from "../src/lib/borrador-registro";

describe("Borrador de Registro Local", () => {
  beforeEach(() => {
    store.clear();
  });

  it("retorna null si no hay borrador guardado", () => {
    expect(leerBorradorRegistroLocal()).toBeNull();
  });

  it("guarda y recupera un borrador válido", () => {
    guardarBorradorRegistroLocal({
      paso: 1,
      nombre: "Carlos",
      apellidos: "Gómez",
      telefono: "5512345678",
      email: "carlos@test.com",
      codigoPostal: "01000",
      estado: "CDMX",
      ciudad: "Álvaro Obregón",
      colonia: "San Ángel",
      tipoLicencia: "A",
      vigenciaLicencia: "2028-12-31"
    });

    const leido = leerBorradorRegistroLocal();
    expect(leido).not.toBeNull();
    expect(leido?.nombre).toBe("Carlos");
    expect(leido?.email).toBe("carlos@test.com");
    expect(leido?.versionEsquema).toBe(2);
  });

  it("limpia el borrador al llamar limpiarBorradorRegistroLocal", () => {
    guardarBorradorRegistroLocal({
      paso: 2,
      nombre: "María",
      apellidos: "López",
      telefono: "5587654321",
      email: "maria@test.com",
      codigoPostal: "03100",
      estado: "CDMX",
      ciudad: "Benito Juárez",
      colonia: "Del Valle",
      tipoLicencia: "B",
      vigenciaLicencia: "2027-05-15"
    });

    limpiarBorradorRegistroLocal();
    expect(leerBorradorRegistroLocal()).toBeNull();
  });

  it("ignora y limpia borradores corruptos", () => {
    localStorageMock.setItem("ruumruum.registro-conductor.borrador.v2", "invalid_json");
    expect(leerBorradorRegistroLocal()).toBeNull();
  });
});
