/**
 * R1 — Fuente única de verdad para CSP/HSTS de app-usuario.
 * Delega en `@ruum/shared/seguridad` (mismo builder que conductor y panel).
 * Se mantiene este módulo como fachada para no romper imports existentes
 * (`./lib/csp`, `../src/middleware`, tests PR-12).
 */

export {
  CSP_ORIGINS,
  CSP_PRESETS,
  PERMISSIONS_POLICY,
  HSTS_HEADER,
  IMAGES_REMOTE_PATTERNS,
  IMAGE_FORMATS,
} from "@ruum/shared/seguridad";
import { buildCsp, CSP_PRESETS } from "@ruum/shared/seguridad";

/**
 * Construye CSP dinámico con nonce (usado por middleware en runtime).
 * `isProd`  => nonce + strict-dynamic, sin unsafe-inline/eval.
 * `isStaging` => el caller decide emitir Report-Only además.
 */
export function buildCspUsuario(nonce: string, isProd: boolean, _isStaging: boolean): string {
  return buildCsp({ nonce, isProd, extras: CSP_PRESETS.usuario });
}

/**
 * CSP estático para `next.config.ts` headers() — sin nonce por request.
 * Prod: 'strict-dynamic' sin unsafe-inline/eval (SEC-002).
 */
export function buildCspEstatico(isProd: boolean): string {
  return buildCsp({ nonce: null, isProd, extras: CSP_PRESETS.usuario });
}
