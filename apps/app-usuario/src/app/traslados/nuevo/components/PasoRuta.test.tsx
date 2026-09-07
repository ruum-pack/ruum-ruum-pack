/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VALORES_INICIALES } from "../constants";
import type { DatosFormulario } from "../types";
import { PasoRuta, type PasoRutaProps } from "./PasoRuta";

function propsIniciales(): PasoRutaProps {
  return {
    datos: { ...VALORES_INICIALES },
    errores: {},
    claseControl: () => "",
    actualizar: vi.fn(),
    actualizarTelefono: vi.fn(),
    actualizarCodigoPostal: vi.fn(),
    consultarCodigoPostal: vi.fn(async () => undefined),
    validarCampo: vi.fn(),
    aplicarSugerenciaCp: vi.fn(),
    aplicarSugerenciaDireccion: vi.fn(),
    cpConsultando: null,
    cpAviso: { origen: null, destino: null },
    cpOpciones: { origen: null, destino: null },
    placesOpciones: { origen: [], destino: [] },
    origenBusqueda: "",
    setOrigenBusqueda: vi.fn(),
    destinoBusqueda: "",
    setDestinoBusqueda: vi.fn(),
    origenSugerencias: [],
    destinoSugerencias: [],
    buscandoOrigen: false,
    buscandoDestino: false,
    rutaEstimacion: null,
    rutaCalculando: false,
    rutaAviso: null,
    onReintentarRuta: vi.fn(),
    onParadasChange: vi.fn(),
    erroresParadas: undefined,
  };
}

describe("PasoRuta", () => {
  it("actualiza los buscadores y referencias cuando cambia el estado controlado", () => {
    const iniciales = propsIniciales();
    const vista = render(<PasoRuta {...iniciales} />);

    const datosActualizados: DatosFormulario = {
      ...iniciales.datos,
      origenReferencias: "Portón azul",
      destinoReferencias: "Acceso por estacionamiento",
    };
    vista.rerender(
      <PasoRuta
        {...iniciales}
        datos={datosActualizados}
        origenBusqueda="Av. Reforma"
        destinoBusqueda="Calle 5"
      />,
    );

    expect(screen.getByLabelText("Buscar dirección de origen")).toHaveValue("Av. Reforma");
    expect(screen.getByLabelText("Buscar dirección de destino")).toHaveValue("Calle 5");
    const referencias = screen.getAllByLabelText("Referencias", { selector: "input" });
    expect(referencias[0]).toHaveValue("Portón azul");
    expect(referencias[1]).toHaveValue("Acceso por estacionamiento");
  });
});
