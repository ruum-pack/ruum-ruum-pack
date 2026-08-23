import { describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn(async () => ({ error: null }));

vi.mock("../src/lib/supabase-browser", () => ({
  crearClienteNavegador: vi.fn(() => ({
    rpc: mockRpc
  }))
}));

import { recordOperationalEvent } from "../src/lib/observability";

describe("Observabilidad (observability.ts)", () => {
  it("envía eventos operativos sanitizados sin exponer PII", async () => {
    await recordOperationalEvent("startup_failure", {
      motivo: "error_carga",
      token: "secret-token",
      curp: "ABCD123456",
      codigo: 500
    });

    expect(mockRpc).toHaveBeenCalledWith(
      "registrar_evento_operativo_app",
      expect.objectContaining({
        p_tipo: "startup_failure",
        p_detalle: expect.not.objectContaining({
          token: "secret-token",
          curp: "ABCD123456"
        })
      })
    );
  });
});
