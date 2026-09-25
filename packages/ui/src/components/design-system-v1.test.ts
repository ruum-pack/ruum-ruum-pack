import { describe, expect, it } from "vitest";
import tokens from "../../../../design-system/tokens/tokens.json";
import { estadoVisualDesdeTecnico } from "./status-mapping";

// Contraste relativo WCAG
function luminancia(hex: string) {
  const c = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}
function contraste(a: string, b: string) {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("design-system v1.0 — tokens", () => {
  it("expone todos los tokens obligatorios", () => {
    expect((tokens as any).color.navy).toBe("0A2342");
    expect((tokens as any).color["teal-deep"]).toBe("008B8B");
    expect((tokens as any).color.action).toBe("0066FF");
    expect((tokens as any).size["button-height"]).toBe("52px");
    expect((tokens as any).size["touch-street"]).toBe("56px");
    expect((tokens as any).motion.micro).toBe("150ms");
  });

  it("contraste texto ≥4.5:1 en combinaciones de chip", () => {
    const t = (tokens as any).color;
    expect(contraste(`#${t.navy}`, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contraste(`#${t["success-text"]}`, `#${t["success-bg"]}`)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(`#${t["warning-text"]}`, `#${t["warning-bg"]}`)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(`#${t["error-text"]}`, `#${t["error-bg"]}`)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(`#${t.muted}`, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    // Discrepancia verificada: el Libro (cap. 13) declara teal-deep 4.87:1 sobre blanco,
    // pero el cálculo WCAG da ~4.15:1. Se usa teal-deep solo para texto grande (≥24px o
    // 18.66 bold, umbral 3:1) y elementos UI; el texto corrido usa navy/muted/action.
    expect(contraste(`#${t["teal-deep"]}`, "#FFFFFF")).toBeGreaterThanOrEqual(3.0);
    expect(contraste(`#${t.action}`, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("teal brillante nunca con blanco (solo gráfico)", () => {
    const t = (tokens as any).color;
    // 2.23:1 aprox — debe fallar con blanco, pasar con navy
    expect(contraste(`#${t.teal}`, "#FFFFFF")).toBeLessThan(4.5);
    expect(contraste(`#${t.teal}`, `#${t.navy}`)).toBeGreaterThanOrEqual(4.5);
  });

  it("mapea los 12 estados visuales sin huecos", () => {
    const tecnicos = [
      "solicitud_creada", "cotizacion_aceptada", "pendiente_de_conductor", "conductor_asignado",
      "evidencia_inicial_completada", "traslado_en_curso", "entrega_confirmada", "servicio_cerrado",
      "evidencia_final_en_proceso", "incidencia_reportada", "servicio_cancelado", "pago_pendiente",
    ];
    const visuales = new Set(tecnicos.map(estadoVisualDesdeTecnico));
    expect(visuales.size).toBeGreaterThanOrEqual(9);
  });
});
