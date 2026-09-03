import { describe, it, expect } from "vitest";
import { esTrasladoActivo, obtenerViajeActivo, obtenerHistorial, construirNotificaciones } from "./inicio";
import type { Database } from "@ruum/shared/types";

type Pasaporte = Database["public"]["Views"]["pasaporte_digital"]["Row"];
function pasaporte(overrides: Partial<Pasaporte> & { traslado_id: string; estado: Pasaporte["estado"] }): Pasaporte {
  const base: Pasaporte = {
    traslado_id: overrides.traslado_id,
    estado: overrides.estado,
    creado_en: overrides.creado_en ?? new Date().toISOString(),
    actualizado_en: overrides.actualizado_en ?? null,
    usuario_id: "u1",
    vehiculo_id: null,
    conductor_id: null,
    tiene_incidencia_abierta: (overrides as Record<string, unknown>).tiene_incidencia_abierta as boolean ?? false,
    tipo_pago: null,
    causa_fallido: null,
    precio_cotizado: null,
    precio_final: null,
    vehiculo_tipo: null,
    vehiculo_marca: null,
    vehiculo_modelo: null,
    vehiculo_anio: null,
    conductor_nombre: null,
    conductor_estado: null,
    conductor_nivel: null,
    conductor_calificacion: null,
    evidencia_inicial_fotos_sincronizadas: 0,
    evidencia_final_fotos_sincronizadas: 0,
    incidencias_abiertas: 0,
    monto_pagado: 0,
    origen_lat: null, origen_lng: null, destino_lat: null, destino_lng: null, distancia_km: null, tiempo_estimado_horas: null,
    vehiculo_categoria_tarifa: null, vehiculo_gama: null, vehiculo_condicion: null,
    origen_direccion: null, origen_ciudad: null, origen_referencias: null, destino_direccion: null, destino_ciudad: null, destino_referencias: null,
    contacto_entrega_nombre: null, contacto_entrega_telefono: null, contacto_recepcion_nombre: null, contacto_recepcion_telefono: null,
    vehiculo_color: null, vehiculo_placas: null, vehiculo_vin: null, ganancia_conductor: null,
  } as unknown as Pasaporte;
  return { ...base, ...overrides } as Pasaporte;
}

describe("inicio helpers (R7)", () => {
  it("esTrasladoActivo false para finalizados", () => {
    expect(esTrasladoActivo("servicio_cerrado")).toBe(false);
    expect(esTrasladoActivo("servicio_cancelado")).toBe(false);
    expect(esTrasladoActivo("traslado_fallido")).toBe(false);
    expect(esTrasladoActivo("reclamo_resuelto")).toBe(false);
    expect(esTrasladoActivo("cierre_operativo_con_incidencia_abierta")).toBe(false);
  });
  it("esTrasladoActivo true para activos", () => {
    expect(esTrasladoActivo("traslado_en_curso")).toBe(true);
    expect(esTrasladoActivo("conductor_asignado")).toBe(true);
  });
  it("obtenerViajeActivo retorna más reciente activo", () => {
    const viejo = pasaporte({ traslado_id: "a", estado: "traslado_en_curso", creado_en: "2024-01-01T00:00:00Z" } as never);
    const nuevo = pasaporte({ traslado_id: "b", estado: "conductor_en_camino_al_origen", creado_en: "2024-02-01T00:00:00Z" } as never);
    const cerrado = pasaporte({ traslado_id: "c", estado: "servicio_cerrado", creado_en: "2024-03-01T00:00:00Z" } as never);
    expect(obtenerViajeActivo([viejo, nuevo, cerrado])?.traslado_id).toBe("b");
  });
  it("obtenerViajeActivo retorna null si solo cerrados", () => {
    expect(obtenerViajeActivo([pasaporte({ traslado_id: "x", estado: "servicio_cerrado" } as never)])).toBeNull();
  });
  it("obtenerHistorial ordena por creado_en desc", () => {
    const a = pasaporte({ traslado_id: "a", estado: "servicio_cerrado", creado_en: "2024-01-01T00:00:00Z" } as never);
    const b = pasaporte({ traslado_id: "b", estado: "servicio_cerrado", creado_en: "2024-03-01T00:00:00Z" } as never);
    expect(obtenerHistorial([a, b]).map((p) => p.traslado_id)).toEqual(["b", "a"]);
  });
  it("construirNotificaciones genera verif. y pagos pendientes", () => {
    const usuario = { id: "u1", estado_verificacion: "pendiente" } as unknown as Database["public"]["Tables"]["usuarios"]["Row"];
    const traslados = [pasaporte({ traslado_id: "t1", estado: "pago_pendiente", tiene_incidencia_abierta: true } as never)];
    const notis = construirNotificaciones(usuario, traslados);
    expect(notis.some((n) => n.id === "verificacion-en-curso")).toBe(true);
    expect(notis.some((n) => n.id.startsWith("incidencia-"))).toBe(true);
    expect(notis.some((n) => n.id.startsWith("pago-"))).toBe(true);
  });
});
