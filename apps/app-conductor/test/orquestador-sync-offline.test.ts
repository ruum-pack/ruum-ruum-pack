import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preferencesStore = vi.hoisted(() => new Map<string, string>());

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: preferencesStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferencesStore.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      preferencesStore.delete(key);
    })
  }
}));

const mockSincronizarColaEvidencia = vi.fn(async () => 0);
const mockLeerColaEvidencia = vi.fn(async () => [] as any[]);
const mockSincronizarColaTelemetria = vi.fn(async () => 0);
const mockObtenerEstadoTrasladoRealtime = vi.fn(async () => ({ estado: "verificacion_vehiculo_en_proceso" } as any));
const mockObtenerPasaporteDigital = vi.fn(async () => null as any);

vi.mock("../src/lib/cola-offline", () => ({
  sincronizarColaEvidencia: (...args: unknown[]) => mockSincronizarColaEvidencia(...args),
  leerColaEvidencia: (...args: unknown[]) => mockLeerColaEvidencia(...args),
  contarColaEvidencia: vi.fn(async () => 0)
}));

vi.mock("../src/lib/cola-telemetria-offline", () => ({
  sincronizarColaTelemetria: (...args: unknown[]) => mockSincronizarColaTelemetria(...args),
  contarColaTelemetria: vi.fn(async () => 0)
}));

vi.mock("@ruum/api/services", () => ({
  obtenerEstadoTrasladoRealtime: (...args: unknown[]) => mockObtenerEstadoTrasladoRealtime(...args),
  obtenerPasaporteDigital: (...args: unknown[]) => mockObtenerPasaporteDigital(...args)
}));

import { orquestarSincronizacionOffline } from "../src/lib/orquestador-sync-offline";
import {
  crearCacheViajeActivoDesdePasaporte,
  guardarCacheViajeActivo,
  leerCacheViajeActivo,
  limpiarCacheViajeActivo
} from "../src/lib/offline-active-trip-cache";
import { calcularSyncSnapshot, obtenerUltimoSyncSnapshot } from "../src/lib/offline-sync-status";

function clienteSupabaseMock({
  user = { id: "user-1" },
  userError = null
}: {
  user?: { id: string } | null;
  userError?: Error | null;
} = {}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: userError }))
    }
  };
}

describe("Orquestador de Sincronización Offline y Caché de Viaje", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    preferencesStore.clear();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    await limpiarCacheViajeActivo();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    vi.restoreAllMocks();
  });

  it("retorna sin_conexion cuando navigator.onLine es falso", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    const cliente = clienteSupabaseMock();
    const resultado = await orquestarSincronizacionOffline(cliente as any);

    expect(resultado).toEqual({ status: "sin_conexion" });
    expect(obtenerUltimoSyncSnapshot().status).toBe("sin_conexion");

    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("retorna accion_requerida cuando la sesión ha expirado", async () => {
    const cliente = clienteSupabaseMock({ user: null });
    const resultado = await orquestarSincronizacionOffline(cliente as any);

    expect(resultado).toEqual({ status: "accion_requerida", reason: "sesion_expirada" });
  });

  it("sincroniza colas cuando no hay viaje activo en caché", async () => {
    mockSincronizarColaEvidencia.mockResolvedValueOnce(3);
    mockSincronizarColaTelemetria.mockResolvedValueOnce(5);

    const cliente = clienteSupabaseMock();
    const resultado = await orquestarSincronizacionOffline(cliente as any);

    expect(resultado).toEqual({
      status: "todo_sincronizado",
      evidencias: 3,
      telemetria: 5
    });
  });

  it("detecta conflicto si la evidencia pendiente es incompatible con el estado del servidor", async () => {
    const pasaporte: any = {
      traslado_id: "t-12345678",
      estado: "verificacion_vehiculo_en_proceso",
      vehiculo_marca: "Nissan",
      vehiculo_modelo: "Versa",
      vehiculo_anio: "2024"
    };
    const cache = crearCacheViajeActivoDesdePasaporte(pasaporte);
    expect(cache).toBeDefined();
    await guardarCacheViajeActivo(cache!);

    // Estado del servidor: entrega confirmada (solo admite final)
    mockObtenerEstadoTrasladoRealtime.mockResolvedValueOnce({ estado: "entrega_confirmada" });
    // Cola tiene evidencia inicial pendiente
    mockLeerColaEvidencia.mockResolvedValueOnce([{ tipo: "inicial", localId: "ev-1" }]);

    const cliente = clienteSupabaseMock();
    const resultado = await orquestarSincronizacionOffline(cliente as any);

    expect(resultado).toMatchObject({
      status: "conflicto_revision",
      reason: expect.stringContaining("incompatible")
    });
  });

  it("completa sincronización y actualiza caché cuando el viaje activo es compatible", async () => {
    const pasaporte: any = {
      traslado_id: "t-87654321",
      estado: "verificacion_vehiculo_en_proceso",
      vehiculo_marca: "Toyota",
      vehiculo_modelo: "Corolla",
      vehiculo_anio: "2025"
    };
    const cache = crearCacheViajeActivoDesdePasaporte(pasaporte);
    await guardarCacheViajeActivo(cache!);

    mockObtenerEstadoTrasladoRealtime.mockResolvedValueOnce({ estado: "verificacion_vehiculo_en_proceso" });
    mockLeerColaEvidencia.mockResolvedValueOnce([]);
    mockSincronizarColaEvidencia.mockResolvedValueOnce(1);
    mockSincronizarColaTelemetria.mockResolvedValueOnce(2);
    mockObtenerPasaporteDigital.mockResolvedValueOnce(pasaporte);

    const cliente = clienteSupabaseMock();
    const resultado = await orquestarSincronizacionOffline(cliente as any);

    expect(resultado).toEqual({
      status: "todo_sincronizado",
      evidencias: 1,
      telemetria: 2
    });

    const cacheGuardado = await leerCacheViajeActivo();
    expect(cacheGuardado?.trasladoId).toBe("t-87654321");
  });

  it("calcula snapshot global con mensajes descriptivos", async () => {
    const snapshot = await calcularSyncSnapshot("pendientes");
    expect(snapshot.status).toBe("pendientes");
    expect(snapshot.message).toContain("pendientes");
  });
});
