import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  configurarStorageTelemetria,
  contarColaTelemetria,
  encolarPuntoTelemetria,
  InMemoryTelemetryQueueStorage,
  leerColaTelemetria,
  limpiarColaTelemetria,
  sincronizarColaTelemetria
} from "../src/lib/cola-telemetria-offline";

const mockRegistrarUbicacion = vi.fn(async () => {});

vi.mock("@ruum/api/services", () => ({
  registrarUbicacionTraslado: (...args: unknown[]) => mockRegistrarUbicacion(...args)
}));

describe("Cola de Telemetría Offline (cola-telemetria-offline)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    configurarStorageTelemetria(new InMemoryTelemetryQueueStorage());
    await limpiarColaTelemetria();
  });

  it("encola puntos de telemetría válidos", async () => {
    const encolado = await encolarPuntoTelemetria(
      "t-100",
      { lat: 19.4326, lng: -99.1332, precisionM: 5, velocidadMps: 10 },
      { usuarioId: "user-1", localId: "p-1" }
    );

    expect(encolado).toBe(true);
    expect(await contarColaTelemetria()).toBe(1);

    const cola = await leerColaTelemetria();
    expect(cola[0].localId).toBe("p-1");
    expect(cola[0].latitude).toBe(19.4326);
  });

  it("descarta puntos duplicados o sin desplazamiento significativo salvo críticos", async () => {
    await encolarPuntoTelemetria(
      "t-100",
      { lat: 19.4326, lng: -99.1332, precisionM: 5 },
      { usuarioId: "user-1", localId: "p-1" }
    );

    // Mismo punto exacto sin desplazamiento
    const segundo = await encolarPuntoTelemetria(
      "t-100",
      { lat: 19.4326, lng: -99.1332, precisionM: 5 },
      { usuarioId: "user-1", localId: "p-2" }
    );
    expect(segundo).toBe(false);
    expect(await contarColaTelemetria()).toBe(1);

    // Punto crítico sí se encola aunque no haya desplazamiento
    const critico = await encolarPuntoTelemetria(
      "t-100",
      { lat: 19.4326, lng: -99.1332, precisionM: 5 },
      { usuarioId: "user-1", localId: "p-critico", critical: true }
    );
    expect(critico).toBe(true);
    expect(await contarColaTelemetria()).toBe(2);
  });

  it("sincroniza puntos pendientes con el servidor y los remueve de la cola", async () => {
    await encolarPuntoTelemetria(
      "t-100",
      { lat: 19.4326, lng: -99.1332 },
      { usuarioId: "user-1", localId: "p-sync-1" }
    );

    const clienteMock = {} as unknown as SupabaseClient<Database>;
    const sincronizados = await sincronizarColaTelemetria(clienteMock);

    expect(sincronizados).toBe(1);
    expect(mockRegistrarUbicacion).toHaveBeenCalledWith(
      clienteMock,
      expect.objectContaining({ trasladoId: "t-100", lat: 19.4326 })
    );
    expect(await contarColaTelemetria()).toBe(0);
  });
});
