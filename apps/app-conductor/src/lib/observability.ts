import { crearClienteNavegador } from "./supabase-browser";
export type OperationalEvent = "startup_failure"|"permission_error"|"tracking_stopped"|"sync_failure"|"evidence_stuck"|"rpc_failure"|"session_expired"|"push_not_registered"|"native_crash"|"session_force_logout";
const FORBIDDEN = /curp|clabe|cuenta|tarjeta|token|signed|photo|foto|url/i;
function sanitize(input: Record<string, unknown> = {}) { return Object.fromEntries(Object.entries(input).filter(([k]) => !FORBIDDEN.test(k)).map(([k,v]) => [k, typeof v === "string" ? v.slice(0, 240) : v])); }
export async function recordOperationalEvent(type: OperationalEvent, details: Record<string, unknown> = {}) {
  try { const client = crearClienteNavegador(); await client.rpc("registrar_evento_operativo_app", { p_tipo: type, p_version_app: "1.0.0", p_detalle: sanitize(details) }); } catch { /* observability must never break operation */ }
}
