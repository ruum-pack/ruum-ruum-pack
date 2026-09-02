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
 * PR-02 P0 — Contrato de recuperación PKCE
 *
 * La autorización para /nueva-password DEBE sobrevivir al callback server-side.
 * No puede depender exclusivamente del evento efímero PASSWORD_RECOVERY que
 * se pierde cuando el servidor ya hizo exchangeCodeForSession.
 *
 * Nuevo contrato:
 *  - Camino principal (PKCE server-side): el callback setea cookie httpOnly
 *    `ruum_rec_*` y la página verifica vía GET /api/recovery/verify (sesión + cookie + ids).
 *    Esta verificación es inmediata y no necesita esperar evento del SDK.
 *  - Camino fallback (hash legacy): si no hay cookie, se observa PASSWORD_RECOVERY
 *    por una ventana corta (no 7s) para compatibilidad con enlaces antiguos.
 *
 * Este helper mantiene compatibilidad pero expone `verificarServidor` para que
 * la UI priorice la verificación server-side y no dependa del timeout.
 *
 * @param soloRecovery - si es `true` solo acepta `PASSWORD_RECOVERY` (uso
 *   recomendado en `/nueva-password`). Así una sesión normal `SIGNED_IN` no
 *   habilita el formulario de cambio de contraseña. Para cambiar contraseña
 *   estando logueado, el flujo correcto es `/cuenta/seguridad` -> enlace por correo.
 *   Por defecto `false` para compatibilidad con tests y `app-usuario` legacy.
 * @param verificarServidor - callback opcional que verifica autorización vía servidor
 *   (cookie httpOnly + sesión). Si retorna true, se autoriza inmediatamente sin
 *   esperar evento ni timeout.
 */
export function observarSesionRecuperacion(
  auth: AuthRecuperacion,
  notificar: (estado: EstadoSesionRecuperacion) => void,
  esperaMaximaMs = 7000,
  opciones: { soloRecovery?: boolean; verificarServidor?: () => Promise<boolean> } = {}
) {
  const { soloRecovery = false, verificarServidor } = opciones;
  const eventosPermitidos = soloRecovery ? EVENTOS_SOLO_RECOVERY : EVENTOS_CON_SESION;
  let activo = true;
  let sesionLista = false;

  const emitir = (verificando: boolean) => {
    if (activo) notificar({ sesionLista, verificando });
  };

  // Camino principal PR-02: verificar vía servidor (cookie httpOnly + sesión) de inmediato.
  // Si el servidor confirma, autorizamos sin esperar evento ni timeout.
  if (verificarServidor) {
    void verificarServidor().then((autorizado) => {
      if (!activo) return;
      if (autorizado) {
        sesionLista = true;
        emitir(false);
      } else if (!soloRecovery) {
        // En modo no estricto, si el servidor no autoriza pero hay sesión, aún permitimos
        // (compatibilidad legacy). En modo soloRecovery no hacemos fallback a getUser.
      }
    });
  }

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

/**
 * Helper puro para páginas que quieren priorizar verificación server-side
 * y solo usar el observer como fallback corto (hash legacy).
 * No usa timeout largo; el caller decide la ventana fallback.
 */
export function crearObservadorRecoveryConServidor(
  auth: AuthRecuperacion,
  notificar: (estado: EstadoSesionRecuperacion) => void,
  verificarServidor: () => Promise<boolean>,
  ventanaFallbackMs = 2500
) {
  return observarSesionRecuperacion(auth, notificar, ventanaFallbackMs, {
    soloRecovery: true,
    verificarServidor,
  });
}
