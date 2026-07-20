import { detenerTrackingNativo, limpiarCredencialesTrackingNativo, obtenerEstadoTrackingNativo, soportaTrackingNativo } from "./background-tracking";
import { desactivarPushDelDispositivo } from "./push-notifications";
import { limpiarCacheViajeActivo } from "./offline-active-trip-cache";
import { limpiarBorradorRegistroLocal } from "./borrador-registro";
import { crearClienteNavegador } from "./supabase-browser";
import { contarColaEvidencia } from "./cola-offline";

export type ResultadoLimpiezaSesion = {
  ok: boolean;
  blocked: boolean;
  errorCount: number;
  pendingEvidence: number;
  pendingTelemetry: number;
};

export async function inspeccionarPendientesAntesDeSalir() {
  const pendingEvidence = await contarColaEvidencia();
  let pendingTelemetry = 0;
  if (soportaTrackingNativo()) {
    try { pendingTelemetry = (await obtenerEstadoTrackingNativo()).pendingCount ?? 0; } catch { pendingTelemetry = 0; }
  }
  return { pendingEvidence, pendingTelemetry };
}

/**
 * Por defecto NO destruye una sesión con evidencia o telemetría pendiente.
 * El flujo de soporte puede usar force=true después de exportar/registrar la incidencia.
 */
export async function limpiarSesionIntegral(options: { force?: boolean } = {}): Promise<ResultadoLimpiezaSesion> {
  const pendientes = await inspeccionarPendientesAntesDeSalir();
  if (!options.force && (pendientes.pendingEvidence > 0 || pendientes.pendingTelemetry > 0)) {
    return { ok: false, blocked: true, errorCount: 0, ...pendientes };
  }

  const errores: unknown[] = [];
  if (soportaTrackingNativo()) {
    try { await detenerTrackingNativo(); } catch (e) { errores.push(e); }
    try { await limpiarCredencialesTrackingNativo(); } catch (e) { errores.push(e); }
  }
  try { await desactivarPushDelDispositivo(); } catch (e) { errores.push(e); }
  try { await crearClienteNavegador().auth.signOut({ scope: "local" }); } catch (e) { errores.push(e); }
  try { await limpiarCacheViajeActivo(); } catch (e) { errores.push(e); }
  limpiarBorradorRegistroLocal();
  if (typeof window !== "undefined") {
    for (const key of Object.keys(localStorage)) if (key.startsWith("ruum_")) localStorage.removeItem(key);
    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent("ruum:session-cleared"));
  }
  return { ok: errores.length === 0, blocked: false, errorCount: errores.length, ...pendientes };
}
