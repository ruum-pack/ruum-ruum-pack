import { describe, expect, it } from "vitest";
import {
  crearRedirectConfirmacion,
  normalizarCorreoRegistro,
  telefonoLocalMx,
  telefonoMx
} from "./registro-usuario";

describe("helpers de registro de usuario", () => {
  it("normaliza correo para auth, confirmacion y reenvio", () => {
    expect(normalizarCorreoRegistro("  USUARIO@Ejemplo.COM ")).toBe("usuario@ejemplo.com");
  });

  it("convierte telefonos mexicanos a captura nacional de 10 digitos", () => {
    expect(telefonoLocalMx("+52 55 1234 5678")).toBe("5512345678");
    expect(telefonoLocalMx("+52 1 55 1234 5678")).toBe("5512345678");
    expect(telefonoMx("55 1234 5678")).toBe("+525512345678");
  });

  it("codifica correctamente el next con query en el callback de confirmacion", () => {
    const redirect = crearRedirectConfirmacion("https://usuario.ruum.test");
    expect(redirect).toBe("https://usuario.ruum.test/auth/callback?next=%2Fonboarding%3Fnuevo%3D1");
    expect(new URL(redirect).searchParams.get("next")).toBe("/onboarding?nuevo=1");
  });
});
