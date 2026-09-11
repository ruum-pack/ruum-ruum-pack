import { describe, expect, it, vi } from "vitest";
import {
  calcularEta,
  finalizarSesionTracking,
  haversineKm,
  iniciarSesionTracking,
  listarUbicacionesRecientes,
  obtenerDestinoTraslado,
  obtenerSaludTracking,
  registrarHeartbeatTracking
} from "./operacional";

const TRASLADO = "00000000-0000-0000-0000-000000000001";

describe("tracking operacional", () => {
  it("iniciar/finalizar validan UUID y delegan", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(iniciarSesionTracking(cliente as never, "no-uuid")).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
    const ok = { rpc: vi.fn().mockResolvedValue({ data: "s1", error: null }) };
    await expect(iniciarSesionTracking(ok as never, TRASLADO)).resolves.toBe("s1");
    await expect(finalizarSesionTracking(ok as never, TRASLADO)).resolves.toBe("s1");
  });

  it("heartbeat valida rangos en cliente", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(
      registrarHeartbeatTracking(cliente as never, { trasladoId: TRASLADO, lat: 200, lng: 0 })
    ).rejects.toThrow();
    await expect(
      registrarHeartbeatTracking(cliente as never, { trasladoId: TRASLADO, lat: 19, lng: 0, bateriaPct: 150 })
    ).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("heartbeat devuelve sesión, punto y salud", async () => {
    const payload = { sesion_id: "s1", punto_id: "p1", salud: { estado: "HEALTHY" } };
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: payload, error: null }) };
    const res = await registrarHeartbeatTracking(cliente as never, { trasladoId: TRASLADO, lat: 19.4, lng: -99.1 });
    expect(res.sesion_id).toBe("s1");
    expect(cliente.rpc).toHaveBeenCalledWith("registrar_heartbeat_tracking", expect.objectContaining({ p_online: true }));
  });

  it("salud propaga el veredicto", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: { estado: "STALE" }, error: null }) };
    await expect(obtenerSaludTracking(cliente as never, TRASLADO)).resolves.toMatchObject({ estado: "STALE" });
  });

  it("recientes ordena descendente con límite", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    await listarUbicacionesRecientes(cliente as never, TRASLADO, 5);
    expect(eq).toHaveBeenCalledWith("traslado_id", TRASLADO);
    expect(order).toHaveBeenCalledWith("registrado_en", { ascending: false });
    expect(limit).toHaveBeenCalledWith(5);
  });

  it("destino devuelve coordenadas o null", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { lat: 19.5, lng: -99.2, ciudad: "CDMX", direccion: "D" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const cliente = { from: vi.fn().mockReturnValue({ select }) };
    const destino = await obtenerDestinoTraslado(cliente as never, TRASLADO);
    expect(destino?.ciudad).toBe("CDMX");
    expect(eq).toHaveBeenCalledWith("id", TRASLADO);
  });

  it("haversine CDMX ~14.9 km", () => {
    expect(haversineKm(19.4326, -99.1332, 19.5, -99.2)).toBeGreaterThan(9);
    expect(haversineKm(19.4326, -99.1332, 19.5, -99.2)).toBeLessThan(12);
    expect(haversineKm(19.4, -99.1, 19.4, -99.1)).toBe(0);
  });

  it("ETA usa velocidad GPS o defecto", () => {
    const conGps = calcularEta(
      { lat: 19.4, lng: -99.1 },
      { lat: 19.5, lng: -99.2 },
      [
        { lat: 0, lng: 0, precision_m: null, velocidad_mps: 10, bateria_pct: null, online: true, registrado_en: "x" },
        { lat: 0, lng: 0, precision_m: null, velocidad_mps: 10, bateria_pct: null, online: true, registrado_en: "x" }
      ]
    );
    expect(conGps.base).toBe("gps");
    expect(conGps.velocidad_kmh).toBe(36);
    expect(conGps.eta_min).toBeGreaterThan(0);
    const sinGps = calcularEta({ lat: 19.4, lng: -99.1 }, { lat: 19.5, lng: -99.2 }, []);
    expect(sinGps.base).toBe("defecto");
    expect(sinGps.velocidad_kmh).toBe(40);
    const sinDestino = calcularEta({ lat: 19.4, lng: -99.1 }, null, []);
    expect(sinDestino.eta_min).toBeNull();
  });
});
