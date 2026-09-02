import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  COOKIE_RECOVERY_USUARIO,
  COOKIE_RECOVERY_CONDUCTOR,
  COOKIE_RECOVERY_LEGACY,
  MAX_AGE_RECOVERY_S,
  RUTA_COOKIE_RECOVERY,
  verificarAutorizacionRecoveryViaServidor,
  limpiarAutorizacionRecoveryViaServidor,
} from "./recovery";

describe("recovery constants — PR-02 contrato", () => {
  it("cookies tienen nombres distintos por app", () => {
    expect(COOKIE_RECOVERY_USUARIO).not.toBe(COOKIE_RECOVERY_CONDUCTOR);
    expect(COOKIE_RECOVERY_USUARIO).toContain("ruum");
    expect(COOKIE_RECOVERY_CONDUCTOR).toContain("ruum");
  });

  it("legacy cookie existe para compatibilidad", () => {
    expect(COOKIE_RECOVERY_LEGACY).toBe("ruum_recovery");
  });

  it("max age es 15 minutos", () => {
    expect(MAX_AGE_RECOVERY_S).toBe(900);
  });

  it("ruta es /", () => {
    expect(RUTA_COOKIE_RECOVERY).toBe("/");
  });
});

describe("verificarAutorizacionRecoveryViaServidor", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("retorna true si endpoint responde authorized true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authorized: true }),
    } as Response);
    await expect(verificarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/recovery/verify", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });

  it("soporta campo alternativo 'autorizado'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ autorizado: true }),
    } as Response);
    await expect(verificarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBe(true);
  });

  it("retorna false si endpoint responde authorized false", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authorized: false }),
    } as Response);
    await expect(verificarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBe(false);
  });

  it("retorna false si fetch falla", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    await expect(verificarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBe(false);
  });

  it("retorna false si response no ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    await expect(verificarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBe(false);
  });
});

describe("limpiarAutorizacionRecoveryViaServidor", () => {
  it("hace POST a /api/recovery/clear sin lanzar si falla", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    await expect(limpiarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/recovery/clear", expect.objectContaining({ method: "POST" }));
  });

  it("no lanza si fetch rechaza", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(limpiarAutorizacionRecoveryViaServidor(fetchMock as unknown as typeof fetch)).resolves.toBeUndefined();
  });
});
