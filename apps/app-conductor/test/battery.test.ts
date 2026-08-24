import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBatteryState, intervaloTrackingMs } from "../src/lib/battery";

describe("battery — OFF-002 ahorro batería", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("fallback si navigator.getBattery no existe", async () => {
    vi.stubGlobal("navigator", {} as unknown as Navigator);
    const state = await getBatteryState();
    expect(state.level).toBe(1);
    expect(state.charging).toBe(true);
    expect(state.lowPower).toBe(false);
  });

  it("detecta lowPower cuando level <0.2 y no charging", async () => {
    vi.stubGlobal("navigator", {
      getBattery: async () => ({ level: 0.15, charging: false }),
    } as unknown as Navigator);
    const state = await getBatteryState();
    expect(state.lowPower).toBe(true);
    expect(state.level).toBe(0.15);
  });

  it("no lowPower si level bajo pero charging true", async () => {
    vi.stubGlobal("navigator", {
      getBattery: async () => ({ level: 0.1, charging: true }),
    } as unknown as Navigator);
    const state = await getBatteryState();
    expect(state.lowPower).toBe(false);
  });

  it("intervaloTrackingMs: disponible + batería baja → 60s (OFF-002)", () => {
    expect(intervaloTrackingMs({ disponible: true, enViaje: false, battery: { level: 0.15, charging: false, lowPower: true } })).toBe(60_000);
    expect(intervaloTrackingMs({ disponible: true, enViaje: false, battery: { level: 0.5, charging: true, lowPower: false } })).toBe(20_000);
  });

  it("intervaloTrackingMs: no disponible → 60s siempre", () => {
    expect(intervaloTrackingMs({ disponible: false, enViaje: false, battery: { level: 1, charging: true, lowPower: false } })).toBe(60_000);
  });

  it("intervaloTrackingMs: enViaje true ignora batería media pero respeta lowPower", () => {
    expect(intervaloTrackingMs({ disponible: false, enViaje: true, battery: { level: 0.4, charging: false, lowPower: false } })).toBe(20_000);
    expect(intervaloTrackingMs({ disponible: false, enViaje: true, battery: { level: 0.1, charging: false, lowPower: true } })).toBe(60_000);
  });

  it("intervaloTrackingMs: batería 0.4 sin enViaje y no charging → 60s", () => {
    expect(intervaloTrackingMs({ disponible: false, enViaje: false, battery: { level: 0.4, charging: false, lowPower: false } })).toBe(60_000);
  });

  it("getBatteryState maneja excepción y retorna fallback", async () => {
    vi.stubGlobal("navigator", {
      getBattery: async () => { throw new Error("not supported"); },
    } as unknown as Navigator);
    const state = await getBatteryState();
    expect(state.level).toBe(1);
  });
});
