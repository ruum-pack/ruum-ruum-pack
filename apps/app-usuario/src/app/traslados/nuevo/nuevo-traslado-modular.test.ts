import { describe, it, expect } from "vitest";
import {
  PASOS,
  pasoDeCampo,
  esCampoEsencialVehiculo,
  soloDigitos,
  telefonoLocalMx,
  telefonoMx,
  nombreCompleto,
  domicilioCompleto,
  referenciasDomicilio,
  formatearDistancia,
  formatearTiempo,
  mensajeAmigableErrorCreacion,
  VALORES_INICIALES
} from "./constants";
import { PasoTarifa } from "./components/PasoTarifa";
import { PasoVehiculo } from "./components/PasoVehiculo";
import { PasoRuta } from "./components/PasoRuta";
import { PasoDetalles } from "./components/PasoDetalles";
import { PasoPago } from "./components/PasoPago";
import { CampoCodigoPostal } from "./components/CampoCodigoPostal";
import { NuevoTrasladoForm } from "./NuevoTrasladoForm";
import { useNuevoTraslado } from "./hooks/useNuevoTraslado";

describe("NuevoTrasladoForm — Arquitectura Modular (GAP 1)", () => {
  it("exporta todos los componentes y hooks desacoplados", () => {
    expect(typeof NuevoTrasladoForm).toBe("function");
    expect(typeof useNuevoTraslado).toBe("function");
    // Paso* usan React.memo -> typeof es 'object' con $$typeof, aceptamos ambos
    expect(["function", "object"]).toContain(typeof PasoTarifa);
    expect(["function", "object"]).toContain(typeof PasoVehiculo);
    expect(["function", "object"]).toContain(typeof PasoRuta);
    expect(["function", "object"]).toContain(typeof PasoDetalles);
    expect(["function", "object"]).toContain(typeof PasoPago);
    expect(["function", "object"]).toContain(typeof CampoCodigoPostal);
  });

  it("define exactamente 5 pasos en PASOS y coinciden con el flujo del wizard", () => {
    expect(PASOS).toHaveLength(5);
    expect(PASOS[0]).toBe("Conoce tu tarifa");
    expect(PASOS[1]).toBe("¿Qué vehículo trasladamos?");
    expect(PASOS[2]).toBe("¿Dónde lo recogemos y llevamos?");
    expect(PASOS[3]).toBe("Detalles del servicio");
    expect(PASOS[4]).toBe("Pago");
  });

  it("clasifica los campos en el paso correspondiente con pasoDeCampo", () => {
    // Paso 0: Gate de tarifa
    expect(pasoDeCampo("origenCodigoPostal")).toBe(0);
    expect(pasoDeCampo("destinoCodigoPostal")).toBe(0);
    expect(pasoDeCampo("marca")).toBe(0);
    expect(pasoDeCampo("modelo")).toBe(0);
    expect(pasoDeCampo("condicion")).toBe(0);
    expect(pasoDeCampo("modalidadProgramacion")).toBe(0);
    expect(pasoDeCampo("fechaHoraProgramada")).toBe(0);

    // Paso 1: Vehículo
    expect(pasoDeCampo("transmision")).toBe(1);
    expect(pasoDeCampo("anio")).toBe(1);
    expect(pasoDeCampo("color")).toBe(1);
    expect(pasoDeCampo("placas")).toBe(1);
    expect(pasoDeCampo("vin")).toBe(1);
    expect(pasoDeCampo("tieneTarjeta")).toBe(1);

    // Paso 2: Ruta y contactos
    expect(pasoDeCampo("origenCalle")).toBe(2);
    expect(pasoDeCampo("destinoCalle")).toBe(2);
    expect(pasoDeCampo("entregaNombre")).toBe(2);
    expect(pasoDeCampo("recepcionTelefono")).toBe(2);
    expect(pasoDeCampo("paradas")).toBe(2);

    // Paso 3: Detalles restantes
    expect(pasoDeCampo("tipoServicio")).toBe(3);
    expect(pasoDeCampo("motivoServicio")).toBe(3);
    expect(pasoDeCampo("tipoRuta")).toBe(3);
  });

  it("distingue campos esenciales de vehículo", () => {
    expect(esCampoEsencialVehiculo("marca")).toBe(true);
    expect(esCampoEsencialVehiculo("modelo")).toBe(true);
    expect(esCampoEsencialVehiculo("anio")).toBe(true);
    expect(esCampoEsencialVehiculo("condicion")).toBe(true);
    expect(esCampoEsencialVehiculo("transmision")).toBe(true);

    expect(esCampoEsencialVehiculo("color")).toBe(false);
    expect(esCampoEsencialVehiculo("placas")).toBe(false);
    expect(esCampoEsencialVehiculo("vin")).toBe(false);
  });

  it("formatea números de teléfono correctamente", () => {
    expect(soloDigitos("55-1234-5678")).toBe("5512345678");
    expect(telefonoLocalMx("+52 55 1234 5678")).toBe("5512345678");
    expect(telefonoLocalMx("525512345678")).toBe("5512345678");
    expect(telefonoMx("5512345678")).toBe("+525512345678");
  });

  it("formatea domicilios, distancias y tiempos de forma legible", () => {
    const dom = domicilioCompleto({
      calle: "Insurgentes Sur",
      numero: "123",
      colonia: "Roma",
      codigoPostal: "06700",
      ciudad: "CDMX",
      estado: "CDMX"
    });
    expect(dom).toBe("Insurgentes Sur 123, Col. Roma, CP 06700, CDMX, CDMX");

    const ref = referenciasDomicilio("Entre calle A y B", "CDMX", "06700");
    expect(ref).toBe("Entre calle A y B | Estado: CDMX | CP: 06700");

    expect(formatearDistancia(12.5)).toBe("12.5 km");
    expect(formatearTiempo(1.5)).toBe("1 h 30 min");
    expect(formatearTiempo(0.4)).toBe("24 min");
  });

  it("maneja mensajes amigables de error sin exponer fallos técnicos crudos", () => {
    const errTarifa = new Error("No hay tarifa configurada para esta ruta");
    expect(mensajeAmigableErrorCreacion(errTarifa)).toContain("No pudimos calcular la tarifa automática");

    const errNegocio = new Error("El vehículo seleccionado no pertenece al usuario");
    expect(mensajeAmigableErrorCreacion(errNegocio)).toBe("El vehículo seleccionado no pertenece al usuario");

    const errGenerico = new Error("Connection timed out at tcp:5432");
    expect(mensajeAmigableErrorCreacion(errGenerico)).toBe(
      "No pudimos crear la solicitud por un problema técnico. Intenta de nuevo en unos segundos; si sigue fallando, contáctanos por soporte."
    );
  });

  it("cuenta con valores iniciales válidos para el formulario", () => {
    expect(VALORES_INICIALES.tipo).toBe("sedan");
    expect(VALORES_INICIALES.modalidadProgramacion).toBe("lo_antes_posible");
    expect(VALORES_INICIALES.tipoRuta).toBe("local");
    expect(VALORES_INICIALES.tipoServicio).toBe("personal");
    expect(VALORES_INICIALES.paradas).toEqual([]);
  });
});
