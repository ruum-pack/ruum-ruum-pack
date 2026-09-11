import { describe, expect, it, vi } from "vitest";
import { completarExportacionAdmin, registrarExportacionAdmin } from "./exports";

describe("exports Torre (Fase 6)", () => {
  it("registrar devuelve el id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "exp-1", error: null });
    await expect(
      registrarExportacionAdmin({ rpc } as never, { recurso: "pagos", filtros: {}, formato: "csv" })
    ).resolves.toBe("exp-1");
    expect(rpc).toHaveBeenCalledWith("admin_registrar_exportacion", expect.objectContaining({ p_recurso: "pagos" }));
  });

  it("completar envía p_error solo en fallo", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await completarExportacionAdmin({ rpc } as never, { id: "e1", filas: 10, hash: "h" });
    expect(rpc).toHaveBeenCalledWith("admin_completar_exportacion", { p_id: "e1", p_filas: 10, p_hash: "h" });
    await completarExportacionAdmin({ rpc } as never, { id: "e1", filas: 0, hash: "", error: "export_failed" });
    expect(rpc).toHaveBeenCalledWith(
      "admin_completar_exportacion",
      expect.objectContaining({ p_error: "export_failed" })
    );
  });
});
