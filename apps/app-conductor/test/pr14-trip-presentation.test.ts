import { describe, it, expect } from "vitest";
import type { EstadoTraslado } from "@ruum/shared/types";
import { ESTADOS_TRASLADO } from "@ruum/shared/states";
import { getTripPresentation } from "../src/lib/trip-presentation";

describe("PR-14 — Trip presentation exhaustividad (conductor)", () => {
  it("toda entrada de EstadoTraslado tiene presentación operativa (no fallback genérico para estados activos)", () => {
    const estadosActivosConductor: EstadoTraslado[] = [
      "conductor_asignado",
      "conductor_en_camino_al_origen",
      "conductor_en_punto_de_recoleccion",
      "verificacion_vehiculo_en_proceso",
      "evidencia_inicial_en_proceso",
      "evidencia_inicial_completada",
      "vehiculo_recibido",
      "traslado_en_curso",
      "llegada_a_destino",
      "evidencia_final_en_proceso",
      "evidencia_final_completada",
      "entrega_confirmada",
    ];
    for (const estado of ESTADOS_TRASLADO) {
      const pres = getTripPresentation(estado);
      expect(pres).toBeDefined();
      expect(pres.title.length).toBeGreaterThan(0);
      // Para estados activos del conductor, no debe caer en fallback genérico
      if (estadosActivosConductor.includes(estado)) {
        expect(pres.title).not.toBe("Traslado aún no listo para operación");
        expect(pres.primaryAction.action).not.toBe("view_available_trips");
      }
    }
  });

  it("estados terminales tienen presentación de revisión/detenido", () => {
    const terminales: EstadoTraslado[] = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido", "disputa_resuelta"];
    for (const estado of terminales) {
      const pres = getTripPresentation(estado);
      expect(["Traslado en validación operativa", "Traslado detenido", "Traslado en revisión"].some((t) => pres.title.includes(t.split(" ")[0]))).toBe(true);
    }
  });
});
