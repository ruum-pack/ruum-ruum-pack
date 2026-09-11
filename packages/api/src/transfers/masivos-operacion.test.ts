import { describe, expect, it, vi } from "vitest";
import {
  crearCargaMasivaOperacion,
  listarCargasDeOperacion,
  obtenerProgresoCarga,
  obtenerResumenOperacionMasiva,
  previsualizarCargaOperacion
} from "./masivos-operacion";

const UUIDS = {
  op: "00000000-0000-0000-0000-000000000001",
  empresa: "00000000-0000-0000-0000-000000000002",
  usuario: "00000000-0000-0000-0000-000000000003",
  carga: "00000000-0000-0000-0000-000000000004"
};

const FILAS = [{ referencia_externa: "A", vehiculo_placas: "X1" }];

describe("masivos-operacion service", () => {
  it("preview valida UUIDs antes de llamar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      previsualizarCargaOperacion(cliente as never, { empresaId: "no-uuid", usuarioId: UUIDS.usuario, filas: FILAS })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("preview delega y devuelve el veredicto", async () => {
    const veredicto = { total_filas: 1, validas: 1, con_error: 0, duplicadas: 0, filas: [] };
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: veredicto, error: null }) };
    const res = await previsualizarCargaOperacion(cliente as never, {
      empresaId: UUIDS.empresa,
      usuarioId: UUIDS.usuario,
      filas: FILAS
    });
    expect(res).toEqual(veredicto);
    expect(cliente.rpc).toHaveBeenCalledWith("admin_previsualizar_carga_masiva", expect.any(Object));
  });

  it("crear exige hash sha256", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      crearCargaMasivaOperacion(cliente as never, {
        operacionId: UUIDS.op,
        empresaId: UUIDS.empresa,
        usuarioId: UUIDS.usuario,
        nombreArchivo: "a.csv",
        filas: FILAS,
        hashArchivo: "corto",
        tamanoBytes: 10,
        mimeType: "text/csv"
      })
    ).rejects.toThrow(/SHA-256/);
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("crear delega en la RPC v2", async () => {
    const resumen = { carga_id: UUIDS.carga, total_filas: 1, operacion_id: UUIDS.op };
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: resumen, error: null }) };
    const res = await crearCargaMasivaOperacion(cliente as never, {
      operacionId: UUIDS.op,
      empresaId: UUIDS.empresa,
      usuarioId: UUIDS.usuario,
      nombreArchivo: "a.csv",
      filas: FILAS,
      hashArchivo: "a".repeat(64),
      tamanoBytes: 10,
      mimeType: "text/csv"
    });
    expect(res.carga_id).toBe(UUIDS.carga);
    expect(cliente.rpc).toHaveBeenCalledWith("admin_crea_carga_masiva_operacion", expect.any(Object));
  });

  it("progreso agrega conteos y porcentaje", async () => {
    const carga = { id: UUIDS.carga, estado: "procesando", total_filas: 4 };
    const filas = [
      { numero_fila: 1, estado: "creada", referencia_externa: "A", errores: [] },
      { numero_fila: 2, estado: "creada", referencia_externa: "B", errores: [] },
      { numero_fila: 3, estado: "error", referencia_externa: "C", errores: ["marca"] },
      { numero_fila: 4, estado: "pendiente", referencia_externa: "D", errores: [] }
    ];
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: carga, error: null }) }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: filas, error: null }) }) });
    const prog = await obtenerProgresoCarga({ from } as never, UUIDS.carga);
    expect(prog).toMatchObject({ creadas: 2, con_error: 1, pendientes: 1, avance_pct: 75 });
    expect(prog.filas_con_error).toHaveLength(1);
  });

  it("progreso falla si no hay carga", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) })
    });
    await expect(obtenerProgresoCarga({ from } as never, UUIDS.carga)).rejects.toThrow(/no encontrada/i);
  });

  it("resumen agrega cargas, estados y centros", async () => {
    const cargas = [
      { id: "c1", nombre_archivo: "a.csv", estado: "procesada", total_filas: 2, filas_creadas: 2, filas_error: 0, creado_en: "2026-09-01" }
    ];
    const traslados = [
      { id: "t1", estado: "traslado_en_curso", conductor_id: "d1", tiene_incidencia_abierta: false },
      { id: "t2", estado: "pendiente_de_conductor", conductor_id: null, tiene_incidencia_abierta: false }
    ];
    const filas = [
      { sucursal_origen_id: "s1", sucursal_destino_id: null, vehiculo_id: "v1" },
      { sucursal_origen_id: "s1", sucursal_destino_id: "s2", vehiculo_id: "v1" }
    ];
    const from = vi.fn()
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue({ data: cargas, error: null }) }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: traslados, error: null }) }) })
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: filas, error: null }) }) });
    const cliente = { from, rpc: vi.fn() };
    const res = await obtenerResumenOperacionMasiva(cliente as never, UUIDS.op);
    expect(res).toMatchObject({
      operacion_id: UUIDS.op,
      cargas: 1,
      filas_totales: 2,
      traslados: 2,
      vehiculos: 1
    });
    expect(res.centros_origen).toEqual(["s1"]);
    expect(res.centros_destino).toEqual(["s2"]);
    expect(res.traslados_por_estado["traslado_en_curso"]).toBe(1);
  });

  it("listarCargasDeOperacion ordena descendente", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    await listarCargasDeOperacion(cliente as never, UUIDS.op);
    expect(eq).toHaveBeenCalledWith("operation_id", UUIDS.op);
    expect(order).toHaveBeenCalledWith("creado_en", { ascending: false });
  });
});
