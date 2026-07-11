import { describe, expect, it } from "vitest";
import { traducirErrorAuth } from "./traducir-error-auth";

describe("errores de integridad del registro de conductor", () => {
  it.each([
    ["conductor_duplicado:curp", "Ya existe un registro con esa CURP."],
    ["conductor_duplicado:telefono", "Ya existe un registro con ese teléfono."],
    ["conductor_duplicado:licencia", "Ya existe un registro con ese número de licencia."],
    ["conductor_duplicado:auth", "Esta cuenta ya tiene un registro de conductor."],
    ["solicitud_duplicada:activa", "Ya tienes una solicitud de conductor en proceso."]
  ])("traduce %s", (message, esperado) => {
    expect(traducirErrorAuth({ message })).toBe(esperado);
  });
});
