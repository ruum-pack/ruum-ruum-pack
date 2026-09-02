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

  it("termina la verificación para un acceso directo sin sesión tras expirar el timeout", async () => {
    vi.useFakeTimers();
    const falsa = authFalsa(null);
    const estados: EstadoSesionRecuperacion[] = [];
    observarSesionRecuperacion(falsa.auth, (estado) => estados.push(estado), 3000);
    vi.advanceTimersByTime(3000);
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

  describe("PR-02 — verificación server-side (cookie httpOnly + sesión)", () => {
    it("autoriza inmediatamente si verificarServidor retorna true (sin esperar evento)", async () => {
      const falsa = authFalsa(null);
      const estados: EstadoSesionRecuperacion[] = [];
      const verificarServidor = vi.fn().mockResolvedValue(true);
      observarSesionRecuperacion(falsa.auth, (e) => estados.push(e), 7000, { soloRecovery: true, verificarServidor });
      await Promise.resolve();
      // microtask de verificarServidor
      await new Promise((r) => setTimeout(r, 0));
      expect(verificarServidor).toHaveBeenCalledOnce();
      expect(estados.some((s) => s.sesionLista && !s.verificando)).toBe(true);
    });

    it("no autoriza si verificarServidor retorna false y no hay evento PASSWORD_RECOVERY", async () => {
      vi.useFakeTimers();
      const falsa = authFalsa(null);
      const estados: EstadoSesionRecuperacion[] = [];
      const verificarServidor = vi.fn().mockResolvedValue(false);
      observarSesionRecuperacion(falsa.auth, (e) => estados.push(e), 3000, { soloRecovery: true, verificarServidor });
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
      vi.advanceTimersByTime(3000);
      // solo debe emitir verificando=false sin sesionLista
      expect(estados.at(-1)).toEqual({ sesionLista: false, verificando: false });
      expect(verificarServidor).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });

    it("fallback a evento PASSWORD_RECOVERY si servidor no autoriza pero luego llega evento", async () => {
      const falsa = authFalsa(null);
      const estados: EstadoSesionRecuperacion[] = [];
      const verificarServidor = vi.fn().mockResolvedValue(false);
      observarSesionRecuperacion(falsa.auth, (e) => estados.push(e), 7000, { soloRecovery: true, verificarServidor });
      await new Promise((r) => setTimeout(r, 0));
      falsa.emitir("PASSWORD_RECOVERY", { id: "u" });
      await Promise.resolve();
      expect(estados.some((s) => s.sesionLista)).toBe(true);
    });

    it("no autoriza con SIGNED_IN cuando soloRecovery true aunque verificarServidor false", async () => {
      const falsa = authFalsa(null);
      const estados: EstadoSesionRecuperacion[] = [];
      const verificarServidor = vi.fn().mockResolvedValue(false);
      observarSesionRecuperacion(falsa.auth, (e) => estados.push(e), 3000, { soloRecovery: true, verificarServidor });
      await new Promise((r) => setTimeout(r, 0));
      falsa.emitir("SIGNED_IN", { id: "u" });
      await Promise.resolve();
      // no debe autorizar
      expect(estados.some((s) => s.sesionLista)).toBe(false);
    });
  });
});
