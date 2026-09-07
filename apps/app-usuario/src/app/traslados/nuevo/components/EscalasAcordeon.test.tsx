/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscalasAcordeon } from "./EscalasAcordeon";
import type { ParadaForm } from "../types";

const sugerirDireccionesMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/mapbox", () => ({
  sugerirDireccionesAutocomplete: sugerirDireccionesMock,
}));

function FormularioParadas() {
  const [paradas, setParadas] = useState<ParadaForm[]>([]);
  return <EscalasAcordeon paradas={paradas} onChange={setParadas} />;
}

describe("EscalasAcordeon", () => {
  it("agrega una parada desde una sola acción y elimina campos operativos", async () => {
    const user = userEvent.setup();
    render(<FormularioParadas />);

    await user.click(screen.getByRole("button", { name: "Agregar escala o tarea" }));
    await user.click(screen.getByRole("radio", { name: "Tarea" }));

    expect(screen.getByRole("combobox", { name: "Buscar dirección de parada 1" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo de tarea" })).toBeInTheDocument();
    expect(screen.queryByText(/Contacto \(nombre\)|Teléfono contacto|Instrucciones tarea|Tiempo espera|Requiere foto\/evidencia/i)).not.toBeInTheDocument();
  });

  it("autocompleta la dirección de la parada hasta calle", async () => {
    const user = userEvent.setup();
    sugerirDireccionesMock.mockResolvedValue([
      {
        textoCompleto: "Av. Reforma 120, Juárez, CDMX",
        direccion: "Av. Reforma",
        colonia: "Juárez",
        codigoPostal: "06600",
        ciudad: "Ciudad de México",
        estado: "CDMX",
        lat: 19.427,
        lng: -99.167,
      },
    ]);
    render(<FormularioParadas />);

    await user.click(screen.getByRole("button", { name: "Agregar escala o tarea" }));
    const busqueda = screen.getByRole("combobox", { name: "Buscar dirección de parada 1" });
    await user.type(busqueda, "Reforma");

    const sugerencia = await screen.findByRole("button", { name: "Av. Reforma 120, Juárez, CDMX" });
    await user.click(sugerencia);

    expect(screen.getByLabelText("Calle")).toHaveValue("Av. Reforma");
    expect(screen.getByLabelText("Colonia")).toHaveValue("Juárez");
    expect(screen.getByLabelText("Código Postal")).toHaveValue("06600");
    expect(screen.getByLabelText("Número")).toHaveValue("");
  });
});
