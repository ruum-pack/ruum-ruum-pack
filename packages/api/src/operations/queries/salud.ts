import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

// FASE 6 (cierre) — Frontera de salud: los endpoints `/api/observabilidad`
// y `/api/health` ya no consultan Supabase directamente. Solo responde si
// la base y las RPC contestan; nunca lanza.

type Cliente = SupabaseClient<Database>;

export interface ChequeoSalud {
  ok: boolean;
  mensaje: string | null;
}

export async function verificarRpcSupabase(cliente: Cliente): Promise<ChequeoSalud> {
  try {
    const { error } = await (cliente as unknown as {
      rpc: (fn: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }>;
    }).rpc("admin_tiene_permiso", { p_permiso: "dashboard:leer" });
    if (error) return { ok: false, mensaje: error.message };
    return { ok: true, mensaje: null };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "error desconocido" };
  }
}

export async function verificarConexionDb(cliente: Cliente): Promise<ChequeoSalud> {
  try {
    const { error } = await (cliente as unknown as {
      from: (tabla: string) => {
        select: (columnas: string) => { limit: (n: number) => Promise<{ error: { message: string } | null }> };
      };
    })
      .from("admins")
      .select("id")
      .limit(1);
    if (error) return { ok: false, mensaje: error.message };
    return { ok: true, mensaje: null };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : "error desconocido" };
  }
}
