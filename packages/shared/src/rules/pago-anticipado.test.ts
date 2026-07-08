import { describe, it, expect } from "vitest";
import { determinarMomentoPago } from "./pago-anticipado";
import type { Usuario } from "../types/usuario";

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: "u1",
    tipo_cuenta: "personal",
    rol: "personal",
    estado_verificacion: "verificado",
    traslados_completados_sin_incidencia: 0,
    metodo_pago_registrado: false,
    creado_en: new Date().toISOString(),
    ...overrides
  };
}

describe("determinarMomentoPago — PRD §4.6", () => {
  it("usuario nuevo sin historial -> anticipado", () => {
    expect(determinarMomentoPago(usuario()).momento).toBe("anticipado");
  });

  it(">=2 traslados sin incidencias y método registrado -> al_cierre", () => {
    const r = determinarMomentoPago(
      usuario({ traslados_completados_sin_incidencia: 2, metodo_pago_registrado: true })
    );
    expect(r.momento).toBe("al_cierre");
  });

  it("2 traslados pero SIN método de pago registrado -> anticipado", () => {
    const r = determinarMomentoPago(usuario({ traslados_completados_sin_incidencia: 2 }));
    expect(r.momento).toBe("anticipado");
  });

  it("titular de cuenta empresa -> al_cierre por defecto", () => {
    const r = determinarMomentoPago(usuario({ tipo_cuenta: "empresa", rol: "titular_empresa" }));
    expect(r.momento).toBe("al_cierre");
  });

  it("usuario_autorizado de empresa (no titular) sin historial -> anticipado", () => {
    const r = determinarMomentoPago(usuario({ tipo_cuenta: "empresa", rol: "usuario_autorizado" }));
    expect(r.momento).toBe("anticipado");
  });

  it("respeta un umbral de historial positivo distinto al default", () => {
    const r = determinarMomentoPago(
      usuario({ traslados_completados_sin_incidencia: 5, metodo_pago_registrado: true }),
      5
    );
    expect(r.momento).toBe("al_cierre");
  });
});
