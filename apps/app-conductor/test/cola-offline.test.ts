import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preferencesStore = vi.hoisted(() => new Map<string, string>());

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: preferencesStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferencesStore.set(key, value);
    })
  }
}));

import {
  configurarStorageColaEvidencia,
  CapacitorPreferencesEvidenceStorage,
  contarColaEvidencia,
  encolarEvidencia,
  InMemoryEvidenceStorage,
  leerColaEvidencia,
  leerColaEvidenciaDeTraslado,
  quitarDeColaEvidencia,
  sincronizarColaEvidencia,
  type EvidenceQueueStorage,
  type ItemColaEvidencia
} from "../src/lib/cola-offline";

const CLAVE_COLA = "ruum_cola_evidencia";
const DATA_URL_JPG = `data:image/jpeg;base64,${Buffer.from("foto").toString("base64")}`;

function item(overrides: Partial<ItemColaEvidencia> = {}): ItemColaEvidencia {
  return {
    localId: "local-1",
    trasladoId: "traslado-1",
    tipo: "inicial",
    angulo: "frontal",
    dataUrl: DATA_URL_JPG,
    lat: 19.4326,
    lng: -99.1332,
    capturadaEn: "2026-07-17T12:00:00.000Z",
    retryCount: 0,
    ...overrides
  };
}

function clienteSupabaseMock({ uploadError = null, upsertError = null }: { uploadError?: Error | null; upsertError?: Error | null } = {}) {
  const upload = vi.fn(async () => ({ error: uploadError }));
  const upsert = vi.fn(async () => ({ error: upsertError }));
  const getPublicUrl = vi.fn();
  const fromStorage = vi.fn(() => ({ upload, getPublicUrl }));
  const fromTable = vi.fn(() => ({ upsert }));

  return {
    cliente: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "auth-user-1" } } }))
      },
      storage: {
        from: fromStorage
      },
      from: fromTable
    },
    upload,
    getPublicUrl,
    upsert,
    fromStorage,
    fromTable
  };
}

describe("cola offline de evidencia", () => {
  beforeEach(() => {
    preferencesStore.clear();
    configurarStorageColaEvidencia(new InMemoryEvidenceStorage());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    configurarStorageColaEvidencia(new InMemoryEvidenceStorage());
  });

  it("persiste, cuenta y filtra la cola por traslado", async () => {
    await encolarEvidencia(item());
    await encolarEvidencia(item({ localId: "local-2", trasladoId: "traslado-2", angulo: "trasera" }));

    expect(await contarColaEvidencia()).toBe(2);
    expect(await contarColaEvidencia("traslado-1")).toBe(1);
    expect(await leerColaEvidenciaDeTraslado("traslado-1")).toMatchObject([{ localId: "local-1" }]);
  });

  it("reemplaza la foto pendiente del mismo traslado, tipo y angulo", async () => {
    await encolarEvidencia(item({ localId: "local-vieja", dataUrl: DATA_URL_JPG }));
    await encolarEvidencia(item({ localId: "local-nueva", dataUrl: `data:image/png;base64,${Buffer.from("nueva").toString("base64")}` }));

    const cola = await leerColaEvidencia();

    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ localId: "local-nueva", angulo: "frontal" });
  });

  it("quita un item por localId sin afectar el resto", async () => {
    await encolarEvidencia(item());
    await encolarEvidencia(item({ localId: "local-2", angulo: "trasera" }));

    await quitarDeColaEvidencia("local-1");

    expect(await leerColaEvidencia()).toMatchObject([{ localId: "local-2" }]);
  });

  it("sincroniza storage y upsert con idempotencia por localId", async () => {
    await encolarEvidencia(item());
    const onItemSincronizado = vi.fn();
    const supabase = clienteSupabaseMock();

    await expect(sincronizarColaEvidencia(supabase.cliente as never, { onItemSincronizado })).resolves.toBe(1);

    expect(supabase.fromStorage).toHaveBeenCalledWith("evidencia");
    expect(supabase.upload.mock.calls[0]?.[0]).toBe("auth-user-1/traslado-1/inicial/local-1-frontal.jpg");
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "local-1",
        traslado_id: "traslado-1",
        tipo: "inicial",
        angulo: "frontal",
        url: "auth-user-1/traslado-1/inicial/local-1-frontal.jpg",
        sincronizada: true
      }),
      { onConflict: "id" }
    );
    expect(supabase.getPublicUrl).not.toHaveBeenCalled();
    expect(onItemSincronizado).toHaveBeenCalledWith(expect.objectContaining({ localId: "local-1" }));
    expect(await leerColaEvidencia()).toEqual([]);
  });

  it("conserva la cola si falla y permite reintentar", async () => {
    await encolarEvidencia(item());
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sincronizarColaEvidencia(clienteSupabaseMock({ uploadError: new Error("sin red") }).cliente as never)).rejects.toThrow(
      "sin red"
    );
    expect(await contarColaEvidencia()).toBe(1);
    expect(await leerColaEvidencia()).toMatchObject([
      {
        localId: "local-1",
        retryCount: 1,
        lastErrorCode: "Error"
      }
    ]);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "evidence_sync_failed",
        scope: "evidencia_offline",
        kind: "offline_recoverable",
        context: expect.objectContaining({
          tripId: "traslado-1",
          evidenceType: "inicial",
          angle: "frontal",
          stage: "storage_upload",
          retryCount: 1,
          errorCode: "Error"
        })
      })
    );
    expect(JSON.stringify(logSpy.mock.calls[0]?.[0])).not.toContain("data:image");

    await expect(sincronizarColaEvidencia(clienteSupabaseMock().cliente as never, { ignoreBackoff: true })).resolves.toBe(1);
    expect(await contarColaEvidencia()).toBe(0);
  });

  it("respeta backoff automatico y permite ignorarlo en reintento manual", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
    await encolarEvidencia(item());
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sincronizarColaEvidencia(clienteSupabaseMock({ uploadError: new Error("sin red") }).cliente as never)).rejects.toThrow(
      "sin red"
    );

    const segundoCliente = clienteSupabaseMock();
    await expect(sincronizarColaEvidencia(segundoCliente.cliente as never)).resolves.toBe(0);
    expect(segundoCliente.upload).not.toHaveBeenCalled();

    await expect(sincronizarColaEvidencia(segundoCliente.cliente as never, { ignoreBackoff: true })).resolves.toBe(1);
    expect(segundoCliente.upload).toHaveBeenCalledTimes(1);
  });

  it("escala el backoff a 1, 5, 15 y 60 minutos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await encolarEvidencia(item({ retryCount: 3, lastAttemptAt: "2026-07-17T12:00:00.000Z" }));

    const antesDeQuince = clienteSupabaseMock();
    vi.setSystemTime(new Date("2026-07-17T12:14:59.000Z"));
    await expect(sincronizarColaEvidencia(antesDeQuince.cliente as never)).resolves.toBe(0);
    expect(antesDeQuince.upload).not.toHaveBeenCalled();

    const despuesDeQuince = clienteSupabaseMock({ uploadError: new Error("sigue sin red") });
    vi.setSystemTime(new Date("2026-07-17T12:15:00.000Z"));
    await expect(sincronizarColaEvidencia(despuesDeQuince.cliente as never)).rejects.toThrow("sigue sin red");
    expect(await leerColaEvidencia()).toMatchObject([{ retryCount: 4 }]);

    const antesDeUnaHora = clienteSupabaseMock();
    vi.setSystemTime(new Date("2026-07-17T13:14:59.000Z"));
    await expect(sincronizarColaEvidencia(antesDeUnaHora.cliente as never)).resolves.toBe(0);
    expect(antesDeUnaHora.upload).not.toHaveBeenCalled();

    const despuesDeUnaHora = clienteSupabaseMock();
    vi.setSystemTime(new Date("2026-07-17T13:15:00.000Z"));
    await expect(sincronizarColaEvidencia(despuesDeUnaHora.cliente as never)).resolves.toBe(1);
  });

  it("normaliza elementos antiguos sin contador persistido", async () => {
    configurarStorageColaEvidencia(new CapacitorPreferencesEvidenceStorage());
    preferencesStore.set(CLAVE_COLA, JSON.stringify([{ ...item(), retryCount: undefined }]));

    await expect(leerColaEvidencia()).resolves.toMatchObject([{ retryCount: 0 }]);
  });

  it("ignora datos corruptos persistidos", async () => {
    configurarStorageColaEvidencia(new CapacitorPreferencesEvidenceStorage());
    preferencesStore.set(CLAVE_COLA, "{");

    await expect(leerColaEvidencia()).resolves.toEqual([]);
  });

  it("propaga fallos del storage para que puedan simularse en unitarias", async () => {
    const storageConFallo: EvidenceQueueStorage = {
      read: async () => [],
      write: async () => {
        throw new Error("storage lleno");
      },
      clear: async () => undefined
    };
    configurarStorageColaEvidencia(storageConFallo);

    await expect(encolarEvidencia(item())).rejects.toThrow("storage lleno");
  });
});
