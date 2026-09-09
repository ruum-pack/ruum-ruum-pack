import { describe, expect, it, vi } from "vitest";
import {
  addTransferToOperation,
  createOperation,
  obtenerResumenOperacional,
  updateOperation
} from "./operaciones";

function clienteCrearOk() {
  const single = vi.fn().mockResolvedValue({
    data: { id: "op-1", folio: "OP-TEST-001", nombre: "XYZ", estado: "borrador", creado_en: "", actualizado_en: "" },
    error: null
  });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { from: vi.fn().mockReturnValue({ insert }), __single: single };
}

describe("operaciones service", () => {
  it("createOperation rechaza nombre vacío sin tocar DB", async () => {
    const cliente = { from: vi.fn() };
    await expect(createOperation(cliente as never, { nombre: "   " })).rejects.toThrow(/obligatorio/);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("createOperation rechaza fechas incoherentes", async () => {
    const cliente = { from: vi.fn() };
    await expect(
      createOperation(cliente as never, {
        nombre: "XYZ",
        planned_start_at: "2026-09-10T00:00:00Z",
        planned_end_at: "2026-09-01T00:00:00Z"
      })
    ).rejects.toThrow(/posterior/);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("createOperation inserta y devuelve la operación", async () => {
    const cliente = clienteCrearOk();
    const op = await createOperation(cliente as never, { nombre: "Operación XYZ" });
    expect(op.folio).toBe("OP-TEST-001");
    expect(cliente.from).toHaveBeenCalledWith("operaciones");
  });

  it("updateOperation rechaza transición inválida borrador -> cerrada", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "op-1", folio: "OP-1", nombre: "X", estado: "borrador", creado_en: "", actualizado_en: "" },
      error: null
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    await expect(updateOperation(cliente as never, "op-1", { estado: "cerrada" })).rejects.toThrow(
      /inválida/
    );
  });

  it("addTransferToOperation actualiza operation_id del traslado", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ update }) };
    await addTransferToOperation(cliente as never, "tr-1", "op-1");
    expect(update).toHaveBeenCalledWith({ operation_id: "op-1" });
    expect(eq).toHaveBeenCalledWith("id", "tr-1");
  });

  it("obtenerResumenOperacional calcula avance y agrupados", async () => {
    const operacion = { id: "op-1", folio: "OP-XYZ", nombre: "XYZ", estado: "en_curso", creado_en: "", actualizado_en: "" };
    const traslados = [
      { id: "t1", estado: "servicio_cerrado", conductor_id: "c1", tiene_incidencia_abierta: false },
      { id: "t2", estado: "traslado_en_curso", conductor_id: "c1", tiene_incidencia_abierta: true },
      { id: "t3", estado: "pendiente_de_conductor", conductor_id: null, tiene_incidencia_abierta: false },
      { id: "t4", estado: "servicio_cerrado", conductor_id: null, tiene_incidencia_abierta: false }
    ];
    const from = vi.fn((tabla: string) => {
      if (tabla === "operaciones") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: operacion, error: null }) }) }) };
      }
      return { select: () => ({ eq: () => Promise.resolve({ data: traslados, error: null }) }) };
    });
    const resumen = await obtenerResumenOperacional({ from } as never, "op-1");
    expect(resumen.total_traslados).toBe(4);
    expect(resumen.con_conductor).toBe(2);
    expect(resumen.sin_conductor).toBe(2);
    expect(resumen.con_incidencia_abierta).toBe(1);
    expect(resumen.avance_pct).toBe(50);
    expect(resumen.por_estado["servicio_cerrado"]).toBe(2);
  });
});
