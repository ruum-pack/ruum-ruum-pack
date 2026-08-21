import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPONENT_FILE = readFileSync(
  resolve(__dirname, "../src/app/viajes/[id]/detalles/TripDetailsTabs.tsx"),
  "utf8"
);

describe("TripDetailsTabs - Pestaña Operación (antes Protocolo)", () => {
  it("renombra la pestaña a Operación", () => {
    expect(COMPONENT_FILE).toContain('label: "Operación"');
    expect(COMPONENT_FILE).toContain('activeTab === "operacion"');
  });

  it("exhibe #Traslado, fecha de traslado, hora de inicio y ventanas", () => {
    expect(COMPONENT_FILE).toContain("# Traslado");
    expect(COMPONENT_FILE).toContain("Fecha de Traslado");
    expect(COMPONENT_FILE).toContain("Hora de Inicio");
    expect(COMPONENT_FILE).toContain("Ventana de Recolección");
    expect(COMPONENT_FILE).toContain("Ventana de Entrega");
  });

  it("presenta solicitante, persona quien entrega y persona quien recibe con llamadas y WhatsApp", () => {
    expect(COMPONENT_FILE).toContain("Solicitante del Servicio");
    expect(COMPONENT_FILE).toContain("Persona quien Entrega (Origen)");
    expect(COMPONENT_FILE).toContain("Persona quien Recibe (Destino)");
    expect(COMPONENT_FILE).toContain("enlaceWhatsApp");
    expect(COMPONENT_FILE).toContain("enlaceTel");
    expect(COMPONENT_FILE).toContain("https://wa.me/");
    expect(COMPONENT_FILE).toContain("tel:");
  });

  it("presenta notas de recogida y notas de entrega", () => {
    expect(COMPONENT_FILE).toContain("Notas de Recogida (Origen)");
    expect(COMPONENT_FILE).toContain("Notas de Entrega (Destino)");
    expect(COMPONENT_FILE).toContain("notasRecogida");
    expect(COMPONENT_FILE).toContain("notasEntrega");
  });
});
