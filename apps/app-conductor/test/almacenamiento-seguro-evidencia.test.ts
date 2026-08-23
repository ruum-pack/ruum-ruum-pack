import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  eliminarJsonLocalSeguro,
  guardarJsonLocalSeguro,
  leerJsonLocalSeguro,
  resetCachedKeyForTesting
} from "../src/lib/almacenamiento-seguro-local";
import { CapacitorPreferencesEvidenceStorage, type ItemColaEvidencia } from "../src/lib/cola-offline";

describe("Almacenamiento Seguro Local y Evidencia Offline", () => {
  beforeEach(() => {
    preferencesStore.clear();
    resetCachedKeyForTesting();
  });

  it("cifra payloads en Capacitor Preferences con prefijo ruum:v1: y AES-GCM", async () => {
    const payload = {
      usuarioId: "usr-123",
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      trasladoId: "traslado-abc"
    };

    await guardarJsonLocalSeguro("test_key", payload);

    const raw = preferencesStore.get("test_key");
    expect(raw).toBeDefined();
    expect(raw).toMatch(/^ruum:v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(raw).not.toContain("data:image");
    expect(raw).not.toContain("usr-123");
    expect(raw).not.toContain("traslado-abc");

    const descifrado = await leerJsonLocalSeguro<typeof payload>("test_key");
    expect(descifrado).toEqual(payload);
  });

  it("mantiene compatibilidad de lectura con datos no cifrados legados", async () => {
    const legado = { legacy: true, mensaje: "antiguo sin cifrar" };
    preferencesStore.set("legacy_key", JSON.stringify(legado));

    const leido = await leerJsonLocalSeguro<typeof legado>("legacy_key");
    expect(leido).toEqual(legado);
  });

  it("retorna null de forma segura ante datos cifrados corruptos", async () => {
    preferencesStore.set("corrupt_key", "ruum:v1:AAAA:BBBB");

    const leido = await leerJsonLocalSeguro("corrupt_key");
    expect(leido).toBeNull();
  });

  it("elimina registros del almacenamiento seguro", async () => {
    await guardarJsonLocalSeguro("eliminar_key", { test: 1 });
    expect(preferencesStore.has("eliminar_key")).toBe(true);

    await eliminarJsonLocalSeguro("eliminar_key");
    expect(preferencesStore.has("eliminar_key")).toBe(false);
    expect(await leerJsonLocalSeguro("eliminar_key")).toBeNull();
  });

  it("CapacitorPreferencesEvidenceStorage protege completamente la evidencia offline", async () => {
    const storage = new CapacitorPreferencesEvidenceStorage();
    const item: ItemColaEvidencia = {
      usuarioId: "conductor-1",
      localId: "local-uuid-1",
      trasladoId: "t-100",
      tipo: "inicial",
      angulo: "frontal",
      dataUrl: "data:image/jpeg;base64,Zm90b19tdXlfc2Vuc2libGU=",
      capturadaEn: new Date().toISOString(),
      retryCount: 0
    };

    await storage.write([item]);

    // Verificar que en Preferences está cifrado
    const stored = preferencesStore.get("ruum_cola_evidencia");
    expect(stored).toBeDefined();
    expect(stored).toMatch(/^ruum:v1:/);
    expect(stored).not.toContain("Zm90b19tdXlfc2Vuc2libGU=");
    expect(stored).not.toContain("data:image");

    // Verificar restauración
    const leidos = await storage.read();
    expect(leidos).toHaveLength(1);
    expect(leidos[0].localId).toBe("local-uuid-1");
    expect(leidos[0].dataUrl).toBe("data:image/jpeg;base64,Zm90b19tdXlfc2Vuc2libGU=");

    // Limpieza
    await storage.clear();
    expect(await storage.read()).toEqual([]);
  });
});
