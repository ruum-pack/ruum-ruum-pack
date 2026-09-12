import { describe, expect, it, vi } from "vitest";
import {
  contarNotificacionesNoLeidas,
  listarNotificacionesConductor,
  marcarNotificacionLeida
} from "./notificaciones";

const FILA = {
  id: "00000000-0000-0000-0000-000000000001",
  tipo: "operativo",
  titulo: "T",
  cuerpo: "C",
  destino: "/viajes",
  entidad_tipo: null,
  entidad_id: null,
  leida_en: null,
  estado: "pendiente",
  creado_en: "2026-09-12T00:00:00.000Z"
};

function clienteLista(filas: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: filas, error: null })
        })
      })
    })
  };
}

describe("drivers notificaciones (Fase 6)", () => {
  it("lista ordenadas con límite", async () => {
    const cliente = clienteLista([FILA]);
    await expect(listarNotificacionesConductor(cliente as never, 100)).resolves.toEqual([FILA]);
    expect(cliente.from).toHaveBeenCalledWith("notificaciones_conductor");
  });

  it("valida el límite antes de consultar", async () => {
    const cliente = clienteLista([]);
    await expect(listarNotificacionesConductor(cliente as never, 0)).rejects.toThrow();
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("cuenta no leídas", async () => {
    const cliente = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ count: 3, error: null })
        })
      })
    };
    await expect(contarNotificacionesNoLeidas(cliente as never)).resolves.toBe(3);
  });

  it("marca leída por RPC validada", async () => {
    const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) };
    await marcarNotificacionLeida(cliente as never, FILA.id);
    expect(cliente.rpc).toHaveBeenCalledWith(
      "marcar_notificacion_leida",
      expect.objectContaining({ p_notificacion_id: FILA.id })
    );
  });

  it("rechaza UUID inválido sin llamar", async () => {
    const cliente = { rpc: vi.fn() };
    await expect(marcarNotificacionLeida(cliente as never, "x")).rejects.toThrow();
    expect(cliente.rpc).not.toHaveBeenCalled();
  });
});
