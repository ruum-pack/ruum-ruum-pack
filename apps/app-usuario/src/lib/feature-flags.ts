/**
 * Fachada: la implementación vive en `@ruum/api/feature-flags` (fuente única,
 * con retry/jitter/dedup/sync cross-tab). Los errores de fetch se reportan a
 * la observabilidad de usuario sin bloquear.
 */
import { crearFeatureFlags } from "@ruum/api/feature-flags";
import { recordOperationalEvent } from "./observability";
import { crearClienteNavegador } from "./supabase-browser";

export const { clearFeatureFlagCache, getFeatureFlagData, isFeatureEnabled } = crearFeatureFlags({
  crearCliente: crearClienteNavegador,
  reportar: (tipo, detalle, severidad) => void recordOperationalEvent("supabase_error", detalle, severidad)
});
