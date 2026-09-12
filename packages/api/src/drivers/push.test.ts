import { describe, expect, it, vi } from "vitest";
import {
  desactivarDispositivoPush,
  registrarAperturaPush,
  registrarDispositivoPush
} from "./push";

const ID = "00000000-0000-0000-0000-000000000001";

describe("drivers push (Fase 6)", () => {
  it("registra dispositivo con parámetros", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await registrarDispositivoPush(cliente as never, { deviceId: "d1", tokenPush: "t" });
    expect(cliente.rpc).toHaveBeenCalledWith(
      "registrar_dispositivo_push",
      expect.objectContaining({ p_device_id: "d1", p_plataforma: "android" })
    );
  });

  it("rechaza token vacío sin llamar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(registrarDispositivoPush(cliente as never, { deviceId: "d1", tokenPush: "" })).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });

  it("registra apertura validada", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await registrarAperturaPush(cliente as never, { notificacionId: ID, deviceId: "d1" });
    expect(cliente.rpc).toHaveBeenCalledWith(
      "registrar_apertura_push",
      expect.objectContaining({ p_notificacion_id: ID })
    );
  });

  it("da de baja el dispositivo", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await desactivarDispositivoPush(cliente as never, "d1");
    expect(cliente.rpc).toHaveBeenCalledWith(
      "desactivar_dispositivo_push",
      expect.objectContaining({ p_device_id: "d1" })
    );
  });

  it("propaga errores", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("db") }) };
    await expect(desactivarDispositivoPush(cliente as never, "d1")).rejects.toThrow("db");
  });
});
