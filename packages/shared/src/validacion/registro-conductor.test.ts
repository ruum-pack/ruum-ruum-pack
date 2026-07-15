import { describe, expect, it } from "vitest";
import {
  diasParaVencerLicencia,
  validarCampoRegistroConductor,
  validarRegistroConductor
} from "./registro-conductor";

function fechaIsoConOffset(dias: number) {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

describe("validarCampoRegistroConductor", () => {
  it("acepta una CURP válida sin importar mayúsculas/minúsculas", () => {
    expect(validarCampoRegistroConductor("curp", "GOMC900101HDFRRL09")).toBe("");
    expect(validarCampoRegistroConductor("curp", "gomc900101hdfrrl09")).toBe("");
  });

  it("rechaza CURP incompleta o con estructura inválida", () => {
    expect(validarCampoRegistroConductor("curp", "GOMC900101")).not.toBe("");
    expect(validarCampoRegistroConductor("curp", "1234567890123456789")).not.toBe("");
  });

  it("exige teléfono nacional de exactamente 10 dígitos", () => {
    expect(validarCampoRegistroConductor("telefono", "5512345678")).toBe("");
    expect(validarCampoRegistroConductor("telefono", "551234567")).not.toBe("");
    expect(validarCampoRegistroConductor("telefono", "55 1234 5678")).not.toBe("");
  });

  it("rechaza contraseñas de solo minúsculas aunque sean largas", () => {
    expect(validarCampoRegistroConductor("password", "puroschidos")).not.toBe("");
    expect(validarCampoRegistroConductor("password", "corta1A")).not.toBe("");
    expect(validarCampoRegistroConductor("password", "carretera2026")).toBe("");
  });

  it("normaliza espacios en textos requeridos", () => {
    expect(validarCampoRegistroConductor("nombre", "  Juan   Manuel  ")).toBe("");
    expect(validarCampoRegistroConductor("nombre", "   J   ")).not.toBe("");
  });

  it("rechaza licencia vencida y acepta la que vence hoy o después", () => {
    expect(validarCampoRegistroConductor("vigenciaLicencia", fechaIsoConOffset(-1))).not.toBe("");
    expect(validarCampoRegistroConductor("vigenciaLicencia", fechaIsoConOffset(0))).toBe("");
    expect(validarCampoRegistroConductor("vigenciaLicencia", fechaIsoConOffset(45))).toBe("");
  });

  it("exige una vigencia con fecha ISO real", () => {
    expect(validarCampoRegistroConductor("vigenciaLicencia", "15/07/2027")).toContain("AAAA-MM-DD");
    expect(validarCampoRegistroConductor("vigenciaLicencia", "2027-99-99")).toContain("AAAA-MM-DD");
  });
});

describe("diasParaVencerLicencia", () => {
  it("calcula días desde la medianoche local", () => {
    expect(diasParaVencerLicencia(fechaIsoConOffset(0))).toBe(0);
    expect(diasParaVencerLicencia(fechaIsoConOffset(30))).toBe(30);
    expect(diasParaVencerLicencia(fechaIsoConOffset(-2))).toBe(-2);
  });
});

describe("validarRegistroConductor", () => {
  const datosValidos = {
    nombre: "Juan",
    apellidos: "Gómez Cruz",
    curp: "GOMC900101HDFRRL09",
    telefono: "5512345678",
    email: "juan@example.com",
    password: "carretera2026",
    codigoPostal: "52104",
    estado: "México",
    ciudad: "San Mateo Atenco",
    colonia: "Centro",
    calle: "Av. Juárez",
    numero: "12",
    referencias: "Portón azul",
    numeroLicencia: "LIC-998877",
    tipoLicencia: "Tipo B - Chofer",
    vigenciaLicencia: fechaIsoConOffset(180),
    contactoEmergenciaNombre: "María Gómez",
    contactoEmergenciaTelefono: "7221234567"
  };

  it("devuelve objeto vacío cuando todo es válido", () => {
    expect(validarRegistroConductor(datosValidos)).toEqual({});
  });

  it("reporta solo los campos inválidos, con su mensaje", () => {
    const errores = validarRegistroConductor({ ...datosValidos, curp: "XX", telefono: "12" });
    expect(Object.keys(errores).sort()).toEqual(["curp", "telefono"]);
    expect(errores.telefono).toContain("10 dígitos");
  });
});
