import { detenerTrackingNativo, limpiarCredencialesTrackingNativo, obtenerEstadoTrackingNativo, soportaTrackingNativo } from "./background-tracking";
import { desactivarPushDelDispositivo } from "./push-notifications";
import { limpiarCacheViajeActivo } from "./offline-active-trip-cache";
import { limpiarBorradorRegistroLocal } from "./borrador-registro";
import { crearClienteNavegador } from "./supabase-browser";
import { contarColaEvidencia, limpiarColaEvidencia } from "./cola-offline";
import { limpiarColaTelemetria } from "./cola-telemetria-offline";
import { recordOperationalEvent } from "./observability";

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
export type AutorizacionForceLogout = {
  autorizadoPor: string;
  motivo: string;
  ticketSoporte: string;
  confirmarPerdidaPendientes: true;
};

export async function limpiarSesionIntegral(options: { force?: boolean; autorizacion?: AutorizacionForceLogout } = {}): Promise<ResultadoLimpiezaSesion> {
  const pendientes = await inspeccionarPendientesAntesDeSalir();
  const hasPending = pendientes.pendingEvidence > 0 || pendientes.pendingTelemetry > 0;
  if (!options.force && hasPending) {
    return { ok: false, blocked: true, errorCount: 0, ...pendientes };
  }
  if (options.force && hasPending) {
    const a = options.autorizacion;
    if (!a?.autorizadoPor?.trim() || !a?.motivo?.trim() || !a?.ticketSoporte?.trim() || a.confirmarPerdidaPendientes !== true) {
      throw new Error("force_logout_authorization_required");
    }
    await recordOperationalEvent("session_force_logout", {
      autorizadoPor: a.autorizadoPor,
      motivo: a.motivo,
      ticketSoporte: a.ticketSoporte,
      pendingEvidence: pendientes.pendingEvidence,
      pendingTelemetry: pendientes.pendingTelemetry,
    });
  }

  const errores: unknown[] = [];
  if (soportaTrackingNativo()) {
    try { await detenerTrackingNativo(); } catch (e) { errores.push(e); }
    try { await limpiarCredencialesTrackingNativo(); } catch (e) { errores.push(e); }
  }
  try { await desactivarPushDelDispositivo(); } catch (e) { errores.push(e); }
  try { await crearClienteNavegador().auth.signOut({ scope: "local" }); } catch (e) { errores.push(e); }
  try { await limpiarCacheViajeActivo(); } catch (e) { errores.push(e); }
  try { await limpiarColaEvidencia(); } catch (e) { errores.push(e); }
  try { await limpiarColaTelemetria(); } catch (e) { errores.push(e); }
  limpiarBorradorRegistroLocal();
  if (typeof window !== "undefined") {
    for (const key of Object.keys(localStorage)) if (key.startsWith("ruum_")) localStorage.removeItem(key);
    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent("ruum:session-cleared"));
  }
  return { ok: errores.length === 0, blocked: false, errorCount: errores.length, ...pendientes };
}
