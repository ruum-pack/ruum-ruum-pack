import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockIniciarTrackingNativo = vi.fn(async () => ({
  active: true,
  lastLocationAt: 0,
  lastSentAt: 0,
  pendingCount: 0
}));
const mockDetenerTrackingNativo = vi.fn(async () => undefined);
let resolverPermisosLento: ((val: { granted: boolean; state: string }) => void) | null = null;
const mockSolicitarUbicacionSegundoPlanoNativa = vi.fn(
  () =>
    new Promise<{ granted: boolean; state: string }>((resolve) => {
      resolverPermisosLento = resolve;
    })
);
const mockSoportaTrackingNativo = vi.fn(() => true);

vi.mock("../src/lib/background-tracking", () => ({
  iniciarTrackingNativo: (...args: unknown[]) => mockIniciarTrackingNativo(...args),
  detenerTrackingNativo: () => mockDetenerTrackingNativo(),
  solicitarUbicacionSegundoPlanoNativa: () => mockSolicitarUbicacionSegundoPlanoNativa(),
  soportaTrackingNativo: () => mockSoportaTrackingNativo()
}));

const mockGetSession = vi.fn(async () => ({
  data: {
    session: {
      user: { id: "conductor-1" },
      access_token: "token-123",
      refresh_token: "refresh-456"
    }
  }
}));

vi.mock("../src/lib/supabase-browser", () => ({
  tieneSupabaseConfigurado: () => true,
  crearClienteNavegador: () => ({
    auth: {
      getSession: mockGetSession
    }
  })
}));

let cleanupActual: (() => void) | void = undefined;

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    default: {
      ...actual
    },
    useEffect: (effect: () => (() => void) | void) => {
      cleanupActual = effect();
    }
  };
});

import { useDriverLocationTracking } from "../src/app/useDriverLocationTracking";
import type { ViajeActivo } from "../src/app/active-trip-state";

describe("useDriverLocationTracking - P2 Prevención de arranque nativo post-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";
    mockSoportaTrackingNativo.mockReturnValue(true);
    resolverPermisosLento = null;
    cleanupActual = undefined;
  });

  afterEach(() => {
    cleanupActual?.();
    vi.restoreAllMocks();
  });

  const viaje1: ViajeActivo = {
    trasladoId: "traslado-1",
    folio: "TR-001",
    estado: "conductor_en_camino_al_origen",
    etapa: "En camino al origen",
    destinoActual: "CDMX"
  };

  const viaje2: ViajeActivo = {
    trasladoId: "traslado-2",
    folio: "TR-002",
    estado: "traslado_en_curso",
    etapa: "Traslado en curso",
    destinoActual: "Monterrey"
  };

  it("inicia tracking nativo cuando el viaje está autorizado y los permisos se conceden", async () => {
    useDriverLocationTracking(viaje1);

    expect(mockDetenerTrackingNativo).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(resolverPermisosLento).toBeTypeOf("function");
    });
    resolverPermisosLento!({ granted: true, state: "granted" });

    await vi.waitFor(() => {
      expect(mockIniciarTrackingNativo).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: "traslado-1",
          userId: "conductor-1",
          tripState: "conductor_en_camino_al_origen"
        })
      );
    });

    cleanupActual?.();
    expect(mockDetenerTrackingNativo).toHaveBeenCalled();
  });

  it("P2: NO arranca tracking nativo si el componente se desmonta mientras los permisos están pendientes", async () => {
    useDriverLocationTracking(viaje1);

    await vi.waitFor(() => {
      expect(resolverPermisosLento).toBeTypeOf("function");
    });

    // Desmontar (ejecutar cleanup) ANTES de resolver los permisos lentos
    cleanupActual?.();
    expect(mockDetenerTrackingNativo).toHaveBeenCalled();

    // Ahora resolver la promesa tardíamente
    resolverPermisosLento!({ granted: true, state: "granted" });

    // Esperar un ciclo y confirmar que NUNCA arrancó el tracking
    await new Promise((r) => setTimeout(r, 50));
    expect(mockIniciarTrackingNativo).not.toHaveBeenCalled();
  });

  it("P2: si el viaje activo cambia mientras los permisos están pendientes, no arranca para el viaje viejo", async () => {
    useDriverLocationTracking(viaje1);

    await vi.waitFor(() => {
      expect(resolverPermisosLento).toBeTypeOf("function");
    });
    const resolverPrimerViaje = resolverPermisosLento;
    resolverPermisosLento = null;

    // Cambiar al viaje 2 (ejecuta cleanup del 1 y arranca el 2)
    cleanupActual?.();
    useDriverLocationTracking(viaje2);

    await vi.waitFor(() => {
      expect(resolverPermisosLento).toBeTypeOf("function");
    });
    const resolverSegundoViaje = resolverPermisosLento;

    // Resolver primero la promesa del viaje viejo
    resolverPrimerViaje!({ granted: true, state: "granted" });

    // Esperar y verificar que NO se inició para viaje-1
    await new Promise((r) => setTimeout(r, 20));
    expect(mockIniciarTrackingNativo).not.toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "traslado-1" })
    );

    // Ahora resolver la del viaje 2
    resolverSegundoViaje!({ granted: true, state: "granted" });

    await vi.waitFor(() => {
      expect(mockIniciarTrackingNativo).toHaveBeenCalledWith(
        expect.objectContaining({
          tripId: "traslado-2",
          tripState: "traslado_en_curso"
        })
      );
    });

    expect(mockIniciarTrackingNativo).not.toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "traslado-1" })
    );
  });

  it("detiene el tracking nativo si el viaje pasa a un estado no rastreable", async () => {
    useDriverLocationTracking(viaje1);

    await vi.waitFor(() => {
      expect(resolverPermisosLento).toBeTypeOf("function");
    });
    resolverPermisosLento!({ granted: true, state: "granted" });

    await vi.waitFor(() => {
      expect(mockIniciarTrackingNativo).toHaveBeenCalled();
    });

    mockDetenerTrackingNativo.mockClear();

    // Cambiar a servicio cerrado (no rastreable)
    cleanupActual?.();
    useDriverLocationTracking({ ...viaje1, estado: "servicio_cerrado" });

    expect(mockDetenerTrackingNativo).toHaveBeenCalled();
  });
});
