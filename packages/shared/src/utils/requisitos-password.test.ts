import { describe, expect, it } from "vitest";
import { passwordCumpleRequisitos, requisitosPassword } from "./requisitos-password";

describe("requisitosPassword", () => {
  it("marca los tres requisitos como no cumplidos para una contraseña vacía", () => {
    const requisitos = requisitosPassword("");
    expect(requisitos).toHaveLength(3);
    expect(requisitos.every((r) => !r.cumplido)).toBe(true);
  });

  it("evalúa cada requisito de forma independiente", () => {
    const requisitos = requisitosPassword("abcdefgh");
    const porClave = Object.fromEntries(requisitos.map((r) => [r.clave, r.cumplido]));
    expect(porClave.longitud).toBe(true);
    expect(porClave.mayuscula).toBe(false);
    expect(porClave.numero).toBe(false);
  });

  it("cumple mayúscula y número cuando están presentes", () => {
    const requisitos = requisitosPassword("Abcdefg1");
    const porClave = Object.fromEntries(requisitos.map((r) => [r.clave, r.cumplido]));
    expect(porClave.longitud).toBe(true);
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

  it("acepta una contraseña que cumple los tres requisitos", () => {
    expect(passwordCumpleRequisitos("Abcdefg1")).toBe(true);
  });
});
