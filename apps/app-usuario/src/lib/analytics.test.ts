/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { registrarEventoUx } from "./analytics";

describe("analytics event names (R7)", () => {
  beforeEach(() => {
    // limpiar listeners y dataLayer
    (globalThis as unknown as { window: unknown }).window = globalThis as unknown as Window;
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    vi.restoreAllMocks();
  });

  it("emite CustomEvent ruum:ux y push a dataLayer", () => {
    const handler = vi.fn();
    window.addEventListener("ruum:ux", handler as EventListener);
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    registrarEventoUx("login_visto", { reason: "authentication_required" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.evento).toBe("login_visto");
    expect((window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer[0]).toMatchObject({ event: "ruum_login_visto", reason: "authentication_required" });
    window.removeEventListener("ruum:ux", handler as EventListener);
  });

  it("no lanza si window undefined (SSR)", async () => {
    const origWindow = (globalThis as unknown as { window: unknown }).window;
    // @ts-ignore
    delete (globalThis as unknown as { window: unknown }).window;
    expect(() => registrarEventoUx("traslado_nuevo_visto")).not.toThrow();
    (globalThis as unknown as { window: unknown }).window = origWindow;
  });

  it("cubre eventos clave de traslado", () => {
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    registrarEventoUx("traslado_nuevo_visto");
    registrarEventoUx("traslado_nuevo_enviado");
    registrarEventoUx("traslado_nuevo_exitoso");
    const dl = (window as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
    expect(dl.map((e) => e.event)).toEqual(["ruum_traslado_nuevo_visto", "ruum_traslado_nuevo_enviado", "ruum_traslado_nuevo_exitoso"]);
  });
});
