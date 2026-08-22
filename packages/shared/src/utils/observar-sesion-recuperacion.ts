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
const EVENTOS_SOLO_RECOVERY = new Set(["PASSWORD_RECOVERY"]);

/**
 * Observa la sesión de recuperación sin depender de un único evento del SDK.
 * Otorga una ventana de tolerancia para conexiones lentas y evita que la UI
 * descarte la verificación antes de que onAuthStateChange procese los eventos del SDK.
 *
 * @param soloRecovery - si es `true` solo acepta `PASSWORD_RECOVERY` (uso
 *   recomendado en `/nueva-password`). Así una sesión normal `SIGNED_IN` no
 *   habilita el formulario de cambio de contraseña. Para cambiar contraseña
 *   estando logueado, el flujo correcto es `/cuenta/seguridad` -> enlace por correo.
 *   Por defecto `false` para compatibilidad con tests y `app-usuario` legacy.
 */
export function observarSesionRecuperacion(
  auth: AuthRecuperacion,
  notificar: (estado: EstadoSesionRecuperacion) => void,
  esperaMaximaMs = 7000,
  opciones: { soloRecovery?: boolean } = {}
) {
  const { soloRecovery = false } = opciones;
  const eventosPermitidos = soloRecovery ? EVENTOS_SOLO_RECOVERY : EVENTOS_CON_SESION;
  let activo = true;
  let sesionLista = false;

  const emitir = (verificando: boolean) => {
    if (activo) notificar({ sesionLista, verificando });
  };

  // En modo estricto (soloRecovery) no confiamos en getUser() inicial:
  // una sesión SIGNED_IN normal no debe habilitar /nueva-password.
  if (!soloRecovery) {
    void auth.getUser().then(({ data }) => {
      if (activo && data.user) {
        sesionLista = true;
        emitir(false);
      }
    });
  }

  const { data: { subscription } } = auth.onAuthStateChange((evento, sesion) => {
    if (!activo || !eventosPermitidos.has(evento) || !sesion?.user) return;
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
