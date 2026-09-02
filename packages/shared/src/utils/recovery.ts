/**
 * Contrato de recuperación PKCE — PR-02 P0
 *
 * Define el contrato explícito para que la autorización de /nueva-password
 * sobreviva al callback server-side sin depender de un evento efímero.
 *
 * Flujo:
 *  1. Usuario solicita recuperación -> resetPasswordForEmail(redirectTo: /auth/callback?type=recovery)
 *  2. Email contiene code PKCE (query) con type=recovery
 *  3. Callback server-side valida code via exchangeCodeForSession/verifyOtp y, si type=recovery,
 *     setea cookie httpOnly `ruum_recovery_*` con userId y expiración corta (15m)
 *  4. /nueva-password verifica vía GET /api/recovery/verify que (cookie presente + sesión válida + ids coinciden)
 *  5. updateUser(password) y luego POST /api/recovery/clear invalida el contexto temporal
 *  6. Reutilización del enlace falla (Supabase single-use) y sin cookie no autoriza
 */

export const COOKIE_RECOVERY_USUARIO = "ruum_rec_usuario";
export const COOKIE_RECOVERY_CONDUCTOR = "ruum_rec_conductor";
// Compat: nombre genérico antiguo, por si alguna instalación lo usa
export const COOKIE_RECOVERY_LEGACY = "ruum_recovery";

export const MAX_AGE_RECOVERY_S = 15 * 60; // 15 minutos (Supabase enlace 60m, ventana segura 15m)
export const RUTA_COOKIE_RECOVERY = "/";

export type EstadoAutorizacionRecuperacion = {
  autorizado: boolean;
  verificando: boolean;
};

export type VerificadorServidor = () => Promise<boolean>;

/**
 * Verifica autorización de recovery vía endpoint server-side.
 * Usado por /nueva-password para no depender del evento PASSWORD_RECOVERY.
 * Retorna true si el servidor confirma (cookie + sesión + ids coinciden).
 */
export async function verificarAutorizacionRecoveryViaServidor(
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  try {
    const res = await fetchFn("/api/recovery/verify", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { authorized?: boolean; autorizado?: boolean };
    return Boolean(data.authorized ?? data.autorizado);
  } catch {
    return false;
  }
}

/**
 * Limpia el marcador temporal de recovery después de updateUser exitoso.
 */
export async function limpiarAutorizacionRecoveryViaServidor(
  fetchFn: typeof fetch = fetch
): Promise<void> {
  try {
    await fetchFn("/api/recovery/clear", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    // best-effort
  }
}
