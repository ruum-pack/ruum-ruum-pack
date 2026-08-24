/**
 * ARQ-002 — Fachada OfflineOrchestrator
 * Unifica cola-offline, cola-telemetria-offline, offline-active-trip-cache y offline-sync-status
 * bajo un único contrato. Los módulos internos siguen existiendo para compatibilidad,
 * pero el código de UI debe importar solo desde aquí.
 *
 * Objetivo: reducir dispersión (6 módulos → 1 fachada), centralizar TTL/purge y exponer
 * snapshot único. Migración progresiva: los imports directos siguen funcionando pero se
 * marca deprecated en favor de OfflineOrchestrator.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import {
  encolarEvidencia,
  leerColaEvidencia,
  leerColaEvidenciaCompleta,
  sincronizarColaEvidencia,
  contarColaEvidencia,
  limpiarColaEvidencia,
  limpiarColaEvidenciaCompleta,
  MAX_REINTENTOS_EVIDENCIA,
  TTL_COLA_EVIDENCIA_MS,
} from "../cola-offline";
import { encolarPuntoTelemetria, sincronizarColaTelemetria, contarColaTelemetria, leerColaTelemetria } from "../cola-telemetria-offline";
import {
  leerCacheViajeActivo,
  guardarCacheViajeActivo,
  limpiarCacheViajeActivo,
  crearCacheViajeActivoDesdePasaporte,
  type OfflineActiveTripCache,
} from "../offline-active-trip-cache";
import { calcularSyncSnapshot, publicarSyncSnapshot, obtenerUltimoSyncSnapshot, type GlobalSyncSnapshot } from "../offline-sync-status";
import { orquestarSincronizacionOffline, type ResultadoOrquestacionOffline } from "../orquestador-sync-offline";

export type { GlobalSyncSnapshot, ResultadoOrquestacionOffline, OfflineActiveTripCache };

/**
 * Purga offline (OFF-001): elimina binarios huérfanos y entradas >TTL.
 * Se ejecuta al iniciar la app y antes de cada sincronización.
 * Retorna número de items purgados.
 */
export async function purgarColaExpirada(): Promise<number> {
  const todas = await leerColaEvidenciaCompleta();
  const ahora = Date.now();
  const expiradas = todas.filter((it) => {
    if (!it.capturadaEn) return false;
    const ms = new Date(it.capturadaEn).getTime();
    return Number.isFinite(ms) && ahora - ms > TTL_COLA_EVIDENCIA_MS;
  });
  const excedidas = todas.filter((it) => typeof it.retryCount === "number" && it.retryCount > MAX_REINTENTOS_EVIDENCIA);
  const aPurgar = new Set([...expiradas, ...excedidas].map((i) => i.localId));
  if (aPurgar.size === 0) return 0;
  // Reescribir cola sin purgados y limpiar binarios (limpiarColaEvidenciaCompleta hace fallback, aquí manual)
  const restantes = todas.filter((it) => !aPurgar.has(it.localId));
  // Usar storage directo para no borrar por usuario
  const { guardarJsonLocalSeguro, eliminarJsonLocalSeguro } = await import("../almacenamiento-seguro-local");
  await guardarJsonLocalSeguro("ruum_cola_evidencia", restantes);
  for (const id of aPurgar) {
    await eliminarJsonLocalSeguro(`ruum_evidencia_bin_${id}`);
  }
  await publicarSyncSnapshot();
  return aPurgar.size;
}

export const OfflineOrchestrator = {
  // Evidencia
  evidencia: {
    encolar: encolarEvidencia,
    leer: leerColaEvidencia,
    leerCompleta: leerColaEvidenciaCompleta,
    sincronizar: sincronizarColaEvidencia,
    contar: contarColaEvidencia,
    limpiar: limpiarColaEvidencia,
    limpiarCompleta: limpiarColaEvidenciaCompleta,
  },
  // Telemetría
  telemetria: {
    encolar: encolarPuntoTelemetria,
    leer: leerColaTelemetria,
    sincronizar: sincronizarColaTelemetria,
    contar: contarColaTelemetria,
  },
  // Cache viaje activo
  cache: {
    leer: leerCacheViajeActivo,
    guardar: guardarCacheViajeActivo,
    limpiar: limpiarCacheViajeActivo,
    crearDesdePasaporte: crearCacheViajeActivoDesdePasaporte,
  },
  // Sync status
  snapshot: {
    calcular: calcularSyncSnapshot,
    publicar: publicarSyncSnapshot,
    ultimo: obtenerUltimoSyncSnapshot,
  },
  // Orquestación completa (evidencia + telemetría + cache)
  sincronizarTodo: async (cliente: SupabaseClient<Database>): Promise<ResultadoOrquestacionOffline> => {
    await purgarColaExpirada();
    return orquestarSincronizacionOffline(cliente);
  },
  purgarExpirada: purgarColaExpirada,
  // Utilidad para UI: estado offline
  isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
} as const;

export default OfflineOrchestrator;
