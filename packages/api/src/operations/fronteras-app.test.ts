import { describe, expect, it, vi } from "vitest";
import { registrarEventoOperativoApp } from "./queries/observabilidad";
import { obtenerFeatureFlagApp } from "./queries/feature-flags";

describe("fronteras app (Fase 6)", () => {
  it("registrarEventoOperativoApp delega en la RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const cliente = { rpc };
    await registrarEventoOperativoApp(cliente as never, { tipo: "x", versionApp: "1", detalle: {} });
    expect(rpc).toHaveBeenCalledWith("registrar_evento_operativo_app", expect.objectContaining({ p_tipo: "x" }));
  });

  it("registrarEventoOperativoApp propaga el error (la app decide tragarlo)", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ error: new Error("db") }) };
    await expect(
      registrarEventoOperativoApp(cliente as never, { tipo: "x", versionApp: "1", detalle: {} })
    ).rejects.toThrow("db");
  });

  it("obtenerFeatureFlagApp normaliza la fila", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { habilitada: true, porcentaje_rollout: 50, versiones_permitidas: ["1.0"] },
      error: null
    });
    const cliente = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }) };
    const flag = await obtenerFeatureFlagApp(cliente as never, "k");
    expect(flag).toEqual({ habilitada: true, porcentaje_rollout: 50, versiones_permitidas: ["1.0"] });
  });

  it("obtenerFeatureFlagApp devuelve null si no hay fila y lanza si hay error", async () => {
    const vacio = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) }) };
    await expect(obtenerFeatureFlagApp(vacio as never, "k")).resolves.toBeNull();
    const roto = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error("db") }) }) }) }) };
    await expect(obtenerFeatureFlagApp(roto as never, "k")).rejects.toThrow("db");
  });
});
