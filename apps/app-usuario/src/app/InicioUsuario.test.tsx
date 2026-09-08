/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Database } from "@ruum/shared/types";
import { InicioUsuario } from "./InicioUsuario";

vi.mock("@ruum/api/services", () => ({
  crearLlamadaEnmascarada: vi.fn(),
}));

vi.mock("../lib/supabase-browser", () => ({
  crearClienteNavegador: vi.fn(),
  tieneSupabaseConfigurado: vi.fn(() => true),
}));

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

describe("InicioUsuario", () => {
  it("muestra la comunicación compacta después de las acciones rápidas cuando hay conductor asignado", () => {
    const traslado = {
      traslado_id: "traslado-1",
      estado: "conductor_asignado",
      creado_en: "2026-09-07T12:00:00.000Z",
      conductor_id: "conductor-1",
      conductor_nombre: "Ana López",
      vehiculo_marca: "Toyota",
      vehiculo_modelo: "Corolla",
      vehiculo_anio: 2024,
      vehiculo_placas: "ABC123D",
    } as unknown as PasaporteRow;

    render(
      <InicioUsuario
        usuario={{ nombre: "Luis Hernández" } as Database["public"]["Tables"]["usuarios"]["Row"]}
        traslados={[traslado]}
      />,
    );

    const acciones = screen.getByRole("region", { name: "Acciones rápidas" });
    const comunicacion = screen.getByRole("region", { name: "Conductor asignado" });
    const tarjetaActiva = screen.getByRole("region", { name: "Traslado Activo #TRASLADO" });

    expect(comunicacion).toBeInTheDocument();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(within(tarjetaActiva).getByRole("heading", { name: "Traslado Activo #TRASLADO" })).toBeInTheDocument();
    expect(within(tarjetaActiva).getByText("Toyota")).toBeInTheDocument();
    expect(within(tarjetaActiva).getByText("Corolla")).toBeInTheDocument();
    expect(within(tarjetaActiva).getByText("2024")).toBeInTheDocument();
    expect(within(tarjetaActiva).getByText("ABC123D")).toBeInTheDocument();
    expect(within(tarjetaActiva).getByText("Conductor asignado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir chat con Ana López" })).toHaveAttribute(
      "href",
      "/traslados/traslado-1#chat-conductor",
    );
    expect(acciones.compareDocumentPosition(comunicacion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Reportar incidencia")).not.toBeInTheDocument();
  });

  it("no muestra el módulo de comunicación sin conductor asignado", () => {
    const traslado = {
      traslado_id: "traslado-2",
      estado: "pendiente_de_conductor",
      creado_en: "2026-09-07T12:00:00.000Z",
      conductor_id: null,
      conductor_nombre: null,
    } as unknown as PasaporteRow;

    render(<InicioUsuario usuario={null} traslados={[traslado]} />);

    expect(screen.queryByRole("region", { name: "Conductor asignado" })).not.toBeInTheDocument();
  });
});
