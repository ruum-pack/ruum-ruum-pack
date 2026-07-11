import { describe, expect, it } from "vitest";
import { traducirErrorAuth } from "./traducir-error-auth";

describe("errores de integridad del registro de conductor", () => {
  it.each([
    ["conductor_duplicado:curp", "Este CURP ya está asociado a otra solicitud."],
    ["conductor_duplicado:telefono", "Ya existe un registro con ese teléfono."],
    ["conductor_duplicado:licencia", "Este número de licencia ya está asociado a otra solicitud."],
    ["conductor_duplicado:auth", "Esta cuenta ya tiene un registro de conductor."],
    ["solicitud_duplicada:activa", "Ya tienes una solicitud de conductor en proceso."]
  ])("traduce %s", (message, esperado) => {
    expect(traducirErrorAuth({ message })).toBe(esperado);
  });
});

describe("errores estándar de Supabase Auth", () => {
  it.each([
    ["email_exists", "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña."],
    ["user_already_exists", "Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña."],
    ["email_address_invalid", "El correo no tiene un formato válido."],
    ["email_not_confirmed", "Confirma tu correo antes de iniciar sesión."],
    ["invalid_credentials", "Correo o contraseña incorrectos."],
    ["weak_password", "La contraseña no cumple los requisitos mínimos."],
    ["same_password", "La nueva contraseña debe ser diferente de la anterior."],
    ["otp_expired", "El enlace o código expiró. Solicita uno nuevo."]
  ])("prioriza el código %s", (code, esperado) => {
    expect(traducirErrorAuth({ code, message: "mensaje técnico distinto" })).toBe(esperado);
  });

  it("prioriza el código sobre una coincidencia textual contradictoria", () => {
    expect(traducirErrorAuth({ code: "otp_expired", message: "Invalid login credentials" }))
      .toBe("El enlace o código expiró. Solicita uno nuevo.");
  });
});
