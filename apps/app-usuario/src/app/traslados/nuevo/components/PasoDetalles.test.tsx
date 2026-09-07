/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VALORES_INICIALES } from "../constants";
import { PasoDetalles, type PasoDetallesProps } from "./PasoDetalles";

function propsIniciales(): PasoDetallesProps {
  return {
    datos: { ...VALORES_INICIALES },
    actualizar: vi.fn(),
    onEditarAgenda: vi.fn(),
    previsualizacion: null,
    previsualizando: false,
    momentoPago: { momento: "al_cierre", razon: "El pago se realiza al finalizar." },
    categoriaCatalogo: "Sedán",
    gamaCatalogo: "General",
    rutaEstimacion: null,
    politicaCancelacion: { mensaje: "Aplican cargos según el momento de cancelación." },
    aceptaPoliticasPagoCancelacion: false,
    setAceptaPoliticasPagoCancelacion: vi.fn(),
    enviarSolicitud: vi.fn(async () => undefined),
    enviando: false,
    cargandoSesion: false,
    tarifaPreviaAceptada: true,
    onRevisarTarifa: vi.fn(),
  };
}

describe("PasoDetalles", () => {
  it("actualiza la aceptación de la política aunque el resto de datos no cambie", () => {
    const iniciales = propsIniciales();
    const vista = render(<PasoDetalles {...iniciales} />);

    vista.rerender(<PasoDetalles {...iniciales} aceptaPoliticasPagoCancelacion />);

    expect(screen.getByLabelText(/acepto la política de cancelación/i)).toBeChecked();
  });
});
