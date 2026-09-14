/**
 * Fachada: la implementación vive en `@ruum/api/feature-flags` (fuente única,
 * con retry/jitter/dedup/sync cross-tab). Los errores de fetch se reportan
 * como `rpc_failure` con el scope original en `flag_scope`.
 */
import { crearFeatureFlags } from "@ruum/api/feature-flags";
import { recordOperationalEvent } from "./observability";
import { crearClienteNavegador } from "./supabase-browser";

export const { clearFeatureFlagCache, getFeatureFlagData, isFeatureEnabled } = crearFeatureFlags({
  crearCliente: crearClienteNavegador,
  reportar: (tipo, detalle, severidad) =>
    void recordOperationalEvent("rpc_failure", { ...detalle, flag_scope: tipo }, severidad)
});
