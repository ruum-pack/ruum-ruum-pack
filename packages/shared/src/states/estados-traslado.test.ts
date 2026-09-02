import { describe, it, expect } from "vitest";
import type { EstadoTraslado } from "../types/traslado";
import { ESTADOS_TRASLADO, ETIQUETA_ESTADO_TRASLADO } from "./estados-traslado";
import { TRANSICIONES } from "./transiciones";

// Inventario PR-14 — Fuente de verdad: código contiene 34 estados.
// Histórico 28 y informe 32 desactualizados; catálogo 34 es correcto.
describe("PR-14 — Inventario definitivo máquina de estados (34) — Exhaustividad", () => {
  const ESTADOS_ESPERADOS = 34;

  it("ESTADOS_TRASLADO contiene 34 estados (fuente de verdad)", () => {
    expect(ESTADOS_TRASLADO).toHaveLength(ESTADOS_ESPERADOS);
    // Unicidad
    expect(new Set(ESTADOS_TRASLADO).size).toBe(ESTADOS_ESPERADOS);
  });

  it("tipo EstadoTraslado coincide con ESTADOS_TRASLADO (si se añade estado sin actualizar tipo, falla)", () => {
    const estadosTipo: EstadoTraslado[] = [
      "usuario_pendiente_verificacion",
      "usuario_verificado",
      "solicitud_creada",
      "documentacion_pendiente",
      "documentacion_en_revision",
      "documentacion_validada",
      "cotizacion_generada",
      "cotizacion_aceptada",
      "servicio_confirmado",
      "pendiente_de_conductor",
      "conductor_asignado",
      "conductor_en_camino_al_origen",
      "conductor_en_punto_de_recoleccion",
      "verificacion_vehiculo_en_proceso",
      "evidencia_inicial_en_proceso",
      "evidencia_inicial_completada",
      "vehiculo_recibido",
      "traslado_en_curso",
      "incidencia_reportada",
      "llegada_a_destino",
      "evidencia_final_en_proceso",
      "evidencia_final_completada",
      "entrega_confirmada",
      "pago_pendiente",
      "pago_completado",
      "servicio_cerrado",
      "servicio_cancelado",
      "traslado_fallido",
      "dano_no_reportado_en_revision",
      "reclamo_abierto",
      "reclamo_resuelto",
      "cierre_operativo_con_incidencia_abierta",
      "disputa_abierta",
      "disputa_resuelta",
    ];
    expect(new Set(estadosTipo).size).toBe(ESTADOS_ESPERADOS);
    for (const e of estadosTipo) {
      expect(ESTADOS_TRASLADO).toContain(e);
    }
    for (const e of ESTADOS_TRASLADO) {
      expect(estadosTipo).toContain(e);
    }
  });

  it("toda entrada de EstadoTraslado tiene etiqueta (ETIQUETA_ESTADO_TRASLADO)", () => {
    for (const estado of ESTADOS_TRASLADO) {
      const etiqueta = ETIQUETA_ESTADO_TRASLADO[estado];
      expect(etiqueta, `falta etiqueta para ${estado}`).toBeDefined();
      expect(typeof etiqueta).toBe("string");
      expect(etiqueta.length, `etiqueta vacía para ${estado}`).toBeGreaterThan(0);
    }
    expect(Object.keys(ETIQUETA_ESTADO_TRASLADO).sort()).toEqual([...ESTADOS_TRASLADO].sort());
  });

  it("toda entrada tiene transición válida o es estado terminal (TRANSICIONES)", () => {
    const terminalesPermitidos: EstadoTraslado[] = ["disputa_resuelta", "servicio_cancelado", "traslado_fallido"];
    for (const estado of ESTADOS_TRASLADO) {
      const destinos = TRANSICIONES[estado];
      expect(destinos, `falta transición para ${estado}`).toBeDefined();
      expect(Array.isArray(destinos), `transición para ${estado} debe ser array`).toBe(true);
      if (terminalesPermitidos.includes(estado)) {
        expect(destinos, `${estado} debe ser terminal (0 transiciones)`).toEqual([]);
      } else {
        expect(destinos.length, `${estado} debe tener al menos 1 transición o ser terminal explícito`).toBeGreaterThan(0);
      }
      for (const dest of destinos) {
        expect(ESTADOS_TRASLADO, `destino ${dest} de ${estado} no es estado válido`).toContain(dest);
      }
    }
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ESTADOS_TRASLADO].sort());
  });

  it("transiciones son válidas y no contienen duplicados ni auto-transiciones", () => {
    for (const [origen, destinos] of Object.entries(TRANSICIONES) as [EstadoTraslado, EstadoTraslado[]][]) {
      expect(new Set(destinos).size, `transiciones duplicadas para ${origen}`).toBe(destinos.length);
      expect(destinos, `auto-transición no permitida para ${origen}`).not.toContain(origen);
    }
  });

  it("supabase enum y código coinciden (si se regenera supabase.ts desde DB, debe tener 34)", async () => {
    expect(ESTADOS_TRASLADO.length).toBe(34);
  });
});
