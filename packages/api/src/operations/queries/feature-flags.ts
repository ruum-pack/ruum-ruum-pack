import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

export interface FeatureFlagApp {
  habilitada: boolean;
  porcentaje_rollout: number;
  versiones_permitidas: string[] | null;
}

/**
 * FASE 6 — Frontera de configuración: lectura cruda de un flag. Cada app
 * conserva su caché/retry/rollout (difieren entre sí a propósito).
 */
export async function obtenerFeatureFlagApp(cliente: Cliente, clave: string): Promise<FeatureFlagApp | null> {
  const { data, error } = await (cliente as unknown as {
    from: (tabla: string) => {
      select: (columnas: string) => {
        eq: (columna: string, valor: string) => {
          maybeSingle: () => Promise<{ data: FeatureFlagApp | null; error: unknown }>;
        };
      };
    };
  })
    .from("feature_flags_app")
    .select("habilitada,porcentaje_rollout,versiones_permitidas")
    .eq("clave", clave)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        habilitada: Boolean(data.habilitada),
        porcentaje_rollout: Number(data.porcentaje_rollout ?? 0),
        versiones_permitidas: (data.versiones_permitidas as string[] | null) ?? null
      }
    : null;
}
