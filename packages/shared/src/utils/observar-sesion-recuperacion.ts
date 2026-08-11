export type EstadoSesionRecuperacion = {
  sesionLista: boolean;
  verificando: boolean;
};

type Suscripcion = { unsubscribe(): void };
type AuthRecuperacion = {
  getUser(): Promise<{ data: { user: unknown | null } }>;
  onAuthStateChange(
    callback: (evento: string, sesion: { user: unknown | null } | null) => void
  ): { data: { subscription: Suscripcion } };
};

const EVENTOS_CON_SESION = new Set(["INITIAL_SESSION", "PASSWORD_RECOVERY", "SIGNED_IN"]);

/**
 * Observa la sesión de recuperación sin depender de un único evento del SDK.
 * Otorga una ventana de tolerancia para conexiones lentas y evita que la UI
 * descarte la verificación antes de que onAuthStateChange procese los eventos del SDK.
 */
export function observarSesionRecuperacion(
  auth: AuthRecuperacion,
  notificar: (estado: EstadoSesionRecuperacion) => void,
  esperaMaximaMs = 7000
) {
  let activo = true;
  let sesionLista = false;

  const emitir = (verificando: boolean) => {
    if (activo) notificar({ sesionLista, verificando });
  };

  void auth.getUser().then(({ data }) => {
    if (activo && data.user) {
      sesionLista = true;
      emitir(false);
    }
  });

  const { data: { subscription } } = auth.onAuthStateChange((evento, sesion) => {
    if (!activo || !EVENTOS_CON_SESION.has(evento) || !sesion?.user) return;
    sesionLista = true;
    emitir(false);
  });

  const timeout = setTimeout(() => emitir(false), esperaMaximaMs);
  return () => {
    activo = false;
    subscription.unsubscribe();
    clearTimeout(timeout);
  };
}
