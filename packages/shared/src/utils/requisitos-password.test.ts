import { describe, expect, it } from "vitest";
import { passwordCumpleRequisitos, requisitosPassword } from "./requisitos-password";
 
describe("requisitosPassword", () => {
  it("marca los cuatro requisitos como no cumplidos para una contraseña vacía", () => {
    const requisitos = requisitosPassword("");
    expect(requisitos).toHaveLength(4);
    expect(requisitos.every((r) => !r.cumplido)).toBe(true);
  });
 
  it("evalúa cada requisito de forma independiente", () => {
    const requisitos = requisitosPassword("ABCDEFGH");
    const porClave = Object.fromEntries(requisitos.map((r) => [r.clave, r.cumplido]));
    expect(porClave.longitud).toBe(true);
    expect(porClave.minuscula).toBe(false);
    expect(porClave.mayuscula).toBe(true);
    expect(porClave.numero).toBe(false);
  });
 
  it("cumple minúscula, mayúscula y número cuando están presentes", () => {
    const requisitos = requisitosPassword("Abcdefg1");
    const porClave = Object.fromEntries(requisitos.map((r) => [r.clave, r.cumplido]));
    expect(porClave.longitud).toBe(true);
    expect(porClave.minuscula).toBe(true);
    expect(porClave.mayuscula).toBe(true);
    expect(porClave.numero).toBe(true);
  });
});
 
describe("passwordCumpleRequisitos", () => {
  it("rechaza contraseñas que cumplen longitud pero no complejidad", () => {
    // Este es exactamente el caso que antes se colaba en app-conductor: el
    // checklist visual mostraba mayúscula/número como pendientes, pero el
    // submit solo validaba la longitud y dejaba enviar la contraseña igual.
    expect(passwordCumpleRequisitos("abcdefgh")).toBe(false);
  });
 
  it("rechaza contraseñas cortas aunque tengan mayúscula y número", () => {
    expect(passwordCumpleRequisitos("Ab1")).toBe(false);
  });
 
  it("rechaza una contraseña sin minúscula aunque tenga mayúscula y número", () => {
    // Caso de regresión: el checklist visual de /nueva-password (app-conductor)
    // marcaba esta contraseña como "cumple todos los requisitos" (longitud +
    // mayúscula + número), pero Supabase la rechazaba con `weak_password`
    // porque auth.password_requirements = "lower_upper_letters_digits"
    // (supabase/config.toml) exige también una minúscula. El usuario quedaba
    // atascado sin saber qué corregir.
    expect(passwordCumpleRequisitos("PASSWORD1")).toBe(false);
    expect(passwordCumpleRequisitos("CONDUCTOR2026")).toBe(false);
  });
 
  it("acepta una contraseña que cumple los cuatro requisitos", () => {
    expect(passwordCumpleRequisitos("Abcdefg1")).toBe(true);
  });
});
 