import { describe, it, expect } from "vitest";
import { chatDisponible } from "./chat-disponible";

describe("chatDisponible", () => {
  it("no está disponible antes de asignar conductor", () => {
    expect(chatDisponible("solicitud_creada")).toBe(false);
    expect(chatDisponible("cotizacion_generada")).toBe(false);
    expect(chatDisponible("pendiente_de_conductor")).toBe(false);
  });

  it("está disponible desde que se asigna conductor", () => {
    expect(chatDisponible("conductor_asignado")).toBe(true);
  });

  it("sigue disponible durante todo el traslado activo", () => {
    expect(chatDisponible("traslado_en_curso")).toBe(true);
    expect(chatDisponible("incidencia_reportada")).toBe(true);
    expect(chatDisponible("evidencia_final_en_proceso")).toBe(true);
  });

  it("sigue disponible mientras se liquida el pago, antes del cierre formal", () => {
    expect(chatDisponible("pago_pendiente")).toBe(true);
    expect(chatDisponible("pago_completado")).toBe(true);
  });

  it("ya NO está disponible una vez cerrado, cancelado o fallido (no 24h de gracia)", () => {
    expect(chatDisponible("servicio_cerrado")).toBe(false);
    expect(chatDisponible("servicio_cancelado")).toBe(false);
    expect(chatDisponible("traslado_fallido")).toBe(false);
  });

  it("no está disponible en los estados post-cierre (reclamos, disputas)", () => {
    expect(chatDisponible("reclamo_abierto")).toBe(false);
    expect(chatDisponible("disputa_abierta")).toBe(false);
    expect(chatDisponible("cierre_operativo_con_incidencia_abierta")).toBe(false);
  });
});
