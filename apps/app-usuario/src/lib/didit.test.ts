import { describe, expect, it } from "vitest";
import { esOrigenDiditValido, interpretarMensajeDidit } from "./didit";

describe("mensajes del iframe de Didit", () => {
  it("lee el envelope oficial con payload anidado", () => {
    expect(
      interpretarMensajeDidit({
        type: "didit:completed",
        data: { sessionId: "session-1", status: "Approved" },
        timestamp: Date.now(),
      })
    ).toEqual({ tipo: "completado", sessionId: "session-1", status: "Approved" });
  });

  it("mantiene compatibilidad con mensajes simples y cancelación", () => {
    expect(interpretarMensajeDidit("didit:complete")).toEqual({ tipo: "completado" });
    expect(interpretarMensajeDidit({ type: "didit:cancelled" })).toEqual({ tipo: "cancelado" });
  });

  it("ignora mensajes que no son eventos de Didit", () => {
    expect(interpretarMensajeDidit({ type: "didit:status_updated", data: { status: "Approved" } })).toBeNull();
  });
});

describe("origen permitido para Didit", () => {
  it("acepta HTTPS de Didit y rechaza otros orígenes", () => {
    expect(esOrigenDiditValido("https://verify.didit.me")).toBe(true);
    expect(esOrigenDiditValido("https://apx.didit.me")).toBe(true);
    expect(esOrigenDiditValido("http://verify.didit.me")).toBe(false);
    expect(esOrigenDiditValido("https://verify.didit.example.com")).toBe(false);
  });
});
