import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

/**
 * FASE 6 — Frontera de exportaciones Torre: registra y completa trabajos de
 * exportación CSV. Preserva los payloads exactos que usaban las rutas
 * (incluidas sus peculiaridades) para no cambiar comportamiento.
 */
export async function registrarExportacionAdmin(
  cliente: Cliente,
  params: { recurso: string; filtros: unknown; formato: string }
): Promise<string> {
  const { data, error } = await cliente.rpc("admin_registrar_exportacion", {
    p_recurso: params.recurso,
    p_filtros: params.filtros as Json,
    p_formato: params.formato
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function completarExportacionAdmin(
  cliente: Cliente,
  params: { id: string; filas: number; hash: string; error?: string | null }
): Promise<void> {
  const { error } = await cliente.rpc("admin_completar_exportacion", {
    p_id: params.id,
    p_filas: params.filas,
    p_hash: params.hash,
    ...(params.error ? { p_error: params.error } : {})
  });
  if (error) throw error;
}
