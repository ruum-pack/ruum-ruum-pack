/**
 * Fachada CSP/HSTS del panel-admin.
 * Delega en `@ruum/shared/seguridad` (mismo builder que conductor y usuario).
 */

export {
  CSP_ORIGINS,
  CSP_PRESETS,
  PERMISSIONS_POLICY,
  HSTS_HEADER,
  IMAGES_REMOTE_PATTERNS,
  IMAGE_FORMATS,
} from "../../../../packages/shared/src/seguridad";
import { buildCsp, CSP_PRESETS } from "../../../../packages/shared/src/seguridad";

/** CSP dinámico con nonce (middleware). Prod: nonce + strict-dynamic. */
export function buildCspPanel(nonce: string, isProd: boolean): string {
  return buildCsp({ nonce, isProd, extras: CSP_PRESETS.panel });
}

/** Fallback estático para `next.config.ts` (sin nonce). */
export function buildCspEstaticoPanel(isProd: boolean): string {
  return buildCsp({ nonce: null, isProd, extras: CSP_PRESETS.panel });
}
