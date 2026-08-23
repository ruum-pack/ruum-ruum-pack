import { describe, expect, it } from "vitest";
import { getTripPresentation } from "../src/lib/trip-presentation";

describe("Presentación de Viajes (trip-presentation)", () => {
  it("retorna configuración de presentación correcta para cada estado del viaje", () => {
    const asignado = getTripPresentation("conductor_asignado");
    expect(asignado.stage).toBe(1);
    expect(asignado.primaryAction.action).toBe("go_origin");
    expect(asignado.primaryAction.label).toBe("Iniciar ruta");

    const enCurso = getTripPresentation("traslado_en_curso");
    expect(enCurso.stage).toBe(5);
    expect(enCurso.primaryAction.action).toBe("mark_arrived_destination");

    const cerrado = getTripPresentation("servicio_cerrado");
    expect(cerrado.stage).toBe(7);
    expect(cerrado.primaryAction.action).toBe("review_status");
  });

  it("gestiona incidencias y decisiones de torre de control", () => {
    const conBloqueo = getTripPresentation("incidencia_reportada", {
      canContinue: false,
      requiresControlTowerDecision: true
    });
    expect(conBloqueo.canContinue).toBe(false);
    expect(conBloqueo.requiresControlTowerDecision).toBe(true);
    expect(conBloqueo.primaryAction.action).toBe("contact_support");

    const autorizada = getTripPresentation("incidencia_reportada", {
      canContinue: true,
      requiresControlTowerDecision: false
    });
    expect(autorizada.canContinue).toBe(true);
    expect(autorizada.primaryAction.action).toBe("go_destination");
  });

  it("retorna fallback adecuado para estados iniciales o desconocidos", () => {
    const cancelado = getTripPresentation("servicio_cancelado");
    expect(cancelado.stage).toBe(7);
    expect(cancelado.primaryAction.action).toBe("view_available_trips");

    const pendiente = getTripPresentation("pendiente_de_conductor");
    expect(pendiente.stage).toBe(1);
    expect(pendiente.primaryAction.action).toBe("view_available_trips");
  });
});
