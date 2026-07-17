import { describe, expect, it } from "vitest";
import { crearConfiguracionContactosSoporte } from "./contactos-soporte";

describe("crearConfiguracionContactosSoporte", () => {
  it("acepta contactos oficiales válidos en producción", () => {
    const configuracion = crearConfiguracionContactosSoporte({
      ambiente: "production",
      telefonoSoporte: "5669522178",
      correoSoporte: "ruum.ruum.mx@gmail.com",
      telefonoEmergencia: "911"
    });

    expect(configuracion.validacion.esValida).toBe(true);
    expect(configuracion.soporte.telefono.esPrueba).toBe(false);
    expect(configuracion.emergencia.telefono.href).toBe("tel:911");
  });

  it("falla en producción si los contactos oficiales están incompletos", () => {
    expect(() =>
      crearConfiguracionContactosSoporte({
        ambiente: "production",
        telefonoSoporte: "55",
        correoSoporte: "soporte-incompleto",
        telefonoEmergencia: "91"
      })
    ).toThrow("Contactos oficiales de Ruum incompletos");
  });

  it("marca los defaults de staging como contactos de prueba sin bloquear el arranque", () => {
    const configuracion = crearConfiguracionContactosSoporte({ ambiente: "staging" });

    expect(configuracion.validacion.esValida).toBe(true);
    expect(configuracion.soporte.telefono.esPrueba).toBe(true);
    expect(configuracion.soporte.telefono.etiqueta).toContain("(pruebas)");
  });
});
