import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./capacitor", () => ({ esNativo: vi.fn() }));
const mockEsNativo = (await import("./capacitor")).esNativo as unknown as ReturnType<typeof vi.fn>;
const mockRequestPermissions = vi.fn();
const mockGetCurrentPosition = vi.fn();

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    requestPermissions: (...a: unknown[]) => mockRequestPermissions(...a),
    getCurrentPosition: (...a: unknown[]) => mockGetCurrentPosition(...a),
  },
}));

describe("ubicacion fallback web (R7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna null si no es nativo (web) — sin pedir permiso", async () => {
    mockEsNativo.mockReturnValue(false);
    const { obtenerUbicacionActual } = await import("./ubicacion");
    expect(await obtenerUbicacionActual()).toBeNull();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it("solicita permiso y retorna coordenadas si granted", async () => {
    mockEsNativo.mockReturnValue(true);
    mockRequestPermissions.mockResolvedValue({ location: "granted" });
    mockGetCurrentPosition.mockResolvedValue({ coords: { latitude: 19.4326, longitude: -99.1332 } });
    const { obtenerUbicacionActual } = await import("./ubicacion");
    const res = await obtenerUbicacionActual();
    expect(res).toEqual({ lat: 19.4326, lng: -99.1332 });
  });

  it("retorna null si permiso denied", async () => {
    mockEsNativo.mockReturnValue(true);
    mockRequestPermissions.mockResolvedValue({ location: "denied" });
    const { obtenerUbicacionActual } = await import("./ubicacion");
    expect(await obtenerUbicacionActual()).toBeNull();
  });

  it("retorna null si getCurrentPosition lanza", async () => {
    mockEsNativo.mockReturnValue(true);
    mockRequestPermissions.mockResolvedValue({ location: "granted" });
    mockGetCurrentPosition.mockRejectedValue(new Error("gps off"));
    const { obtenerUbicacionActual } = await import("./ubicacion");
    expect(await obtenerUbicacionActual()).toBeNull();
  });
});
