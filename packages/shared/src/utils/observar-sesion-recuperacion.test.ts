import { afterEach, describe, expect, it, vi } from "vitest";
import { observarSesionRecuperacion, type EstadoSesionRecuperacion } from "./observar-sesion-recuperacion";

afterEach(() => vi.useRealTimers());

function authFalsa(usuarioInicial: unknown | null) {
  let listener: ((evento: string, sesion: { user: unknown | null } | null) => void) | undefined;
  const unsubscribe = vi.fn();
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: usuarioInicial } }),
      onAuthStateChange: vi.fn((callback) => {
        listener = callback;
        return { data: { subscription: { unsubscribe } } };
      })
    },
    emitir: (evento: string, user: unknown | null) => listener?.(evento, { user }),
    unsubscribe
  };
}

describe("observarSesionRecuperacion", () => {
  it("acepta una sesión ya existente aunque llegue como INITIAL_SESSION", async () => {
    const falsa = authFalsa({ id: "usuario" });
    const estados: EstadoSesionRecuperacion[] = [];
    observarSesionRecuperacion(falsa.auth, (estado) => estados.push(estado));
    falsa.emitir("INITIAL_SESSION", { id: "usuario" });
    await Promise.resolve();
    expect(estados.some((estado) => estado.sesionLista && !estado.verificando)).toBe(true);
  });

  it.each(["PASSWORD_RECOVERY", "SIGNED_IN"])("acepta el evento %s", async (evento) => {
    const falsa = authFalsa(null);
    const estados: EstadoSesionRecuperacion[] = [];
    observarSesionRecuperacion(falsa.auth, (estado) => estados.push(estado));
    falsa.emitir(evento, { id: "usuario" });
    await Promise.resolve();
    expect(estados.some((estado) => estado.sesionLista)).toBe(true);
  });

  it("termina la verificación para un acceso directo sin sesión", async () => {
    const falsa = authFalsa(null);
    const estados: EstadoSesionRecuperacion[] = [];
    observarSesionRecuperacion(falsa.auth, (estado) => estados.push(estado));
    await Promise.resolve();
    await Promise.resolve();
    expect(estados.at(-1)).toEqual({ sesionLista: false, verificando: false });
  });

  it("cancela listener y evita notificaciones después del desmontaje", async () => {
    const falsa = authFalsa(null);
    const notificar = vi.fn();
    const cancelar = observarSesionRecuperacion(falsa.auth, notificar);
    cancelar();
    falsa.emitir("PASSWORD_RECOVERY", { id: "usuario" });
    await Promise.resolve();
    expect(falsa.unsubscribe).toHaveBeenCalledOnce();
    expect(notificar).not.toHaveBeenCalled();
  });

  it("el timeout evita una verificación indefinida", () => {
    vi.useFakeTimers();
    const falsa = authFalsa(null);
    const estados: EstadoSesionRecuperacion[] = [];
    observarSesionRecuperacion(falsa.auth, (estado) => estados.push(estado), 3000);
    vi.advanceTimersByTime(3000);
    expect(estados.at(-1)).toEqual({ sesionLista: false, verificando: false });
  });
});
