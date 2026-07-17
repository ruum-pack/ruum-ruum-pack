import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, errorCode, sanitizeLogContext } from "./logger";

describe("structured logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacta campos sensibles antes de escribir logs", () => {
    expect(
      sanitizeLogContext({
        tripId: "traslado-1",
        dataUrl: "data:image/jpeg;base64,abc",
        token: "secret",
        nested: {
          publicUrl: "https://storage.test/foto.jpg",
          retryCount: 2
        }
      })
    ).toEqual({
      tripId: "traslado-1",
      dataUrl: "[redacted]",
      token: "[redacted]",
      nested: {
        publicUrl: "[redacted]",
        retryCount: 2
      }
    });
  });

  it("extrae un codigo operativo estable sin serializar el error completo", () => {
    expect(errorCode({ code: "PGRST301", message: "detalle" })).toBe("PGRST301");
    expect(errorCode(new TypeError("fallo"))).toBe("TypeError");
    expect(errorCode("fallo")).toBe("unknown_error");
  });

  it("emite entradas estructuradas con scope, tipo y contexto sanitizado", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createLogger("evidencia_offline");

    logger.error(
      "evidence_sync_failed",
      {
        tripId: "traslado-1",
        evidenceType: "inicial",
        dataUrl: "data:image/jpeg;base64,abc",
        errorCode: "StorageError"
      },
      "offline_recoverable"
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "evidence_sync_failed",
        level: "error",
        scope: "evidencia_offline",
        kind: "offline_recoverable",
        context: {
          tripId: "traslado-1",
          evidenceType: "inicial",
          dataUrl: "[redacted]",
          errorCode: "StorageError"
        }
      })
    );
  });
});
