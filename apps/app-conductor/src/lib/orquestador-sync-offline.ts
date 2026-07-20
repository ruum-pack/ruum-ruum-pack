import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { obtenerPasaporteDigital } from "@ruum/api/services";
import { obtenerEstadoTrasladoRealtime } from "@ruum/api/services";
import { sincronizarColaEvidencia, leerColaEvidencia } from "./cola-offline";
import { sincronizarColaTelemetria } from "./cola-telemetria-offline";
import { crearCacheViajeActivoDesdePasaporte, guardarCacheViajeActivo, leerCacheViajeActivo } from "./offline-active-trip-cache";
import { publicarSyncSnapshot } from "./offline-sync-status";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

const ESTADOS_COMPATIBLES_EVIDENCIA: Record<"inicial" | "final", EstadoTraslado[]> = {
  inicial: ["verificacion_vehiculo_en_proceso", "evidencia_inicial_en_proceso"],
  final: ["llegada_a_destino", "evidencia_final_en_proceso"]
};

export type ResultadoOrquestacionOffline =
  | { status: "todo_sincronizado"; evidencias: number; telemetria: number }
  | { status: "sin_conexion" }
  | { status: "accion_requerida"; reason: "sesion_expirada" }
  | { status: "conflicto_revision"; reason: string }
  | { status: "error_recuperable"; reason: string };

function hayEvidenciaIncompatible(
  estadoServidor: EstadoTraslado,
  pendientes: Awaited<ReturnType<typeof leerColaEvidencia>>
) {
  return pendientes.find((item) => !ESTADOS_COMPATIBLES_EVIDENCIA[item.tipo].includes(estadoServidor));
}

export async function orquestarSincronizacionOffline(cliente: SupabaseClient<Database>): Promise<ResultadoOrquestacionOffline> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await publicarSyncSnapshot("sin_conexion");
    return { status: "sin_conexion" };
  }

  await publicarSyncSnapshot("sincronizando");

  try {
    const { data: userResult, error: userError } = await cliente.auth.getUser();
    if (userError || !userResult.user) {
      await publicarSyncSnapshot("accion_requerida");
      return { status: "accion_requerida", reason: "sesion_expirada" };
    }

    const cache = await leerCacheViajeActivo();
    if (!cache) {
      const evidencias = await sincronizarColaEvidencia(cliente);
      const telemetria = await sincronizarColaTelemetria(cliente);
      await publicarSyncSnapshot();
      return { status: "todo_sincronizado", evidencias, telemetria };
    }

    const estadoServidor = await obtenerEstadoTrasladoRealtime(cliente, cache.trasladoId);
    if (!estadoServidor) {
      await publicarSyncSnapshot("conflicto_revision");
      return { status: "conflicto_revision", reason: "traslado_no_disponible" };
    }

    const pendientesEvidencia = await leerColaEvidencia(cache.trasladoId);
    const incompatible = hayEvidenciaIncompatible(estadoServidor.estado, pendientesEvidencia);
    if (incompatible) {
      await publicarSyncSnapshot("conflicto_revision");
      return {
        status: "conflicto_revision",
        reason: `evidencia_${incompatible.tipo}_incompatible_con_${estadoServidor.estado}`
      };
    }

    const evidencias = await sincronizarColaEvidencia(cliente, { trasladoId: cache.trasladoId });
    const telemetria = await sincronizarColaTelemetria(cliente);
    const pasaporte = await obtenerPasaporteDigital(cliente, cache.trasladoId);
    const cacheActualizado = pasaporte ? crearCacheViajeActivoDesdePasaporte(pasaporte, cache.ultimaUbicacionConocida) : null;
    if (cacheActualizado) await guardarCacheViajeActivo(cacheActualizado);

    await publicarSyncSnapshot();
    return { status: "todo_sincronizado", evidencias, telemetria };
  } catch (error) {
    await publicarSyncSnapshot("error_recuperable");
    return { status: "error_recuperable", reason: error instanceof Error ? error.message : "sync_failed" };
  }
}

