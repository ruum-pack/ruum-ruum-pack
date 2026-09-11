import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { withIdempotentRetry } from "../operations/infrastructure/retry";

type Cliente = SupabaseClient<Database>;

export interface EvidenciaVehiculoTraslado {
  traslado_id: string;
  traslado_estado: string;
  fotos: Array<{
    id: string;
    tipo: string;
    angulo: string;
    url: string | null;
    capturada_en: string;
    sincronizada: boolean;
  }>;
}

/**
 * Obtiene la evidencia (fotos) asociada a un vehículo a través de sus traslados.
 */

export async function obtenerEvidenciaVehiculo(
  cliente: Cliente,
  vehiculoId: string
): Promise<EvidenciaVehiculoTraslado[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_obtener_evidencia_vehiculo",
    args: { p_vehiculo_id: string }
  ) => Promise<{ data: EvidenciaVehiculoTraslado[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_obtener_evidencia_vehiculo", {
    p_vehiculo_id: vehiculoId
  });
  if (error) throw error;
  return data ?? [];
}

export async function exportarEvidenciaFirmada(
  cliente: Cliente,
  trasladoIds: string[]
): Promise<{ evidencia: Array<{ traslado_id: string; fotos: Array<{ id: string; tipo: string; angulo: string; storage_path: string; capturada_en: string }> }>; total: number }> {
  await assertAdminPermission(cliente, "viajes:gestionar");
  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_exportar_evidencia_firmada",
      args: { p_traslado_ids: string[] }
    ) => Promise<{ data: { evidencia: Array<{ traslado_id: string; fotos: Array<{ id: string; tipo: string; angulo: string; storage_path: string; capturada_en: string }> }>; total: number } | null; error: unknown }>;
    const { data, error } = await rpc("admin_exportar_evidencia_firmada", { p_traslado_ids: trasladoIds });
    if (error) throw error;
    if (!data) return { evidencia: [], total: 0 };
    return data;
  });
}
