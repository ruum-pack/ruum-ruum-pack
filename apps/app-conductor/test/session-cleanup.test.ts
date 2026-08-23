import { beforeEach, describe, expect, it, vi } from "vitest";

const mockContarColaEvidencia = vi.fn(async () => 0);
const mockLimpiarColaEvidencia = vi.fn(async () => {});
const mockLimpiarColaEvidenciaCompleta = vi.fn(async () => {});
const mockLimpiarColaTelemetria = vi.fn(async () => {});
const mockDetenerTrackingNativo = vi.fn(async () => {});
const mockLimpiarCredencialesTrackingNativo = vi.fn(async () => {});
const mockObtenerEstadoTrackingNativo = vi.fn(async () => ({ pendingCount: 0 }));
const mockDesactivarPushDelDispositivo = vi.fn(async () => {});
const mockLimpiarCacheViajeActivo = vi.fn(async () => {});
const mockLimpiarBorradorRegistroLocal = vi.fn(() => {});
const mockRecordOperationalEvent = vi.fn(async () => {});
const mockSignOut = vi.fn(async () => ({ error: null }));
const mockGetUser = vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null }));

vi.mock("../src/lib/background-tracking", () => ({
  soportaTrackingNativo: vi.fn(() => true),
  detenerTrackingNativo: () => mockDetenerTrackingNativo(),
  limpiarCredencialesTrackingNativo: () => mockLimpiarCredencialesTrackingNativo(),
  obtenerEstadoTrackingNativo: () => mockObtenerEstadoTrackingNativo()
}));

vi.mock("../src/lib/push-notifications", () => ({
  desactivarPushDelDispositivo: () => mockDesactivarPushDelDispositivo()
}));

vi.mock("../src/lib/offline-active-trip-cache", () => ({
  limpiarCacheViajeActivo: () => mockLimpiarCacheViajeActivo()
}));

vi.mock("../src/lib/borrador-registro", () => ({
  limpiarBorradorRegistroLocal: () => mockLimpiarBorradorRegistroLocal()
}));

vi.mock("../src/lib/cola-offline", () => ({
  contarColaEvidencia: () => mockContarColaEvidencia(),
  limpiarColaEvidencia: (...args: unknown[]) => mockLimpiarColaEvidencia(...args),
  limpiarColaEvidenciaCompleta: () => mockLimpiarColaEvidenciaCompleta()
}));

vi.mock("../src/lib/cola-telemetria-offline", () => ({
  limpiarColaTelemetria: () => mockLimpiarColaTelemetria()
}));

vi.mock("../src/lib/observability", () => ({
  recordOperationalEvent: (...args: unknown[]) => mockRecordOperationalEvent(...args)
}));

vi.mock("../src/lib/supabase-browser", () => ({
  tieneSupabaseConfigurado: vi.fn(() => true),
  crearClienteNavegador: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut
    }
  }))
}));

import {
  inspeccionarPendientesAntesDeSalir,
  limpiarSesionIntegral
} from "../src/lib/session-cleanup";

describe("Limpieza Integral de Sesión (session-cleanup)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inspecciona correctamente los pendientes de evidencia y telemetría", async () => {
    mockContarColaEvidencia.mockResolvedValueOnce(3);
    mockObtenerEstadoTrackingNativo.mockResolvedValueOnce({ pendingCount: 2 });

    const pendientes = await inspeccionarPendientesAntesDeSalir();
    expect(pendientes).toEqual({ pendingEvidence: 3, pendingTelemetry: 2 });
  });

  it("bloquea el logout si hay pendientes y force no está habilitado", async () => {
    mockContarColaEvidencia.mockResolvedValueOnce(2);
    mockObtenerEstadoTrackingNativo.mockResolvedValueOnce({ pendingCount: 0 });

    const resultado = await limpiarSesionIntegral({ force: false });
    expect(resultado.ok).toBe(false);
    expect(resultado.blocked).toBe(true);
    expect(resultado.pendingEvidence).toBe(2);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("requiere autorización explícita cuando se fuerza el logout con pendientes", async () => {
    mockContarColaEvidencia.mockResolvedValueOnce(1);
    mockObtenerEstadoTrackingNativo.mockResolvedValueOnce({ pendingCount: 0 });

    await expect(limpiarSesionIntegral({ force: true })).rejects.toThrow(
      "force_logout_authorization_required"
    );
  });

  it("completa el logout forzado cuando la autorización es válida", async () => {
    mockContarColaEvidencia.mockResolvedValueOnce(1);
    mockObtenerEstadoTrackingNativo.mockResolvedValueOnce({ pendingCount: 0 });

    const resultado = await limpiarSesionIntegral({
      force: true,
      autorizacion: {
        autorizadoPor: "admin-soporte@ruum.mx",
        motivo: "Dispositivo dañado en campo",
        ticketSoporte: "TICKET-8899",
        confirmarPerdidaPendientes: true
      }
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.blocked).toBe(false);
    expect(mockRecordOperationalEvent).toHaveBeenCalledWith(
      "session_force_logout",
      expect.objectContaining({ ticketSoporte: "TICKET-8899" })
    );
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockDetenerTrackingNativo).toHaveBeenCalled();
  });

  it("ejecuta limpieza limpia completa cuando no hay pendientes", async () => {
    mockContarColaEvidencia.mockResolvedValueOnce(0);
    mockObtenerEstadoTrackingNativo.mockResolvedValueOnce({ pendingCount: 0 });

    const resultado = await limpiarSesionIntegral();
    expect(resultado.ok).toBe(true);
    expect(resultado.blocked).toBe(false);
    expect(mockDetenerTrackingNativo).toHaveBeenCalled();
    expect(mockLimpiarCredencialesTrackingNativo).toHaveBeenCalled();
    expect(mockDesactivarPushDelDispositivo).toHaveBeenCalled();
    expect(mockLimpiarCacheViajeActivo).toHaveBeenCalled();
    expect(mockLimpiarBorradorRegistroLocal).toHaveBeenCalled();
  });
});
