import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import { rpcValidado } from "../../services/_rpc-validado";

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

export interface PoliticaVersionApp {
  current: string;
  minimum: string;
  recommended: string;
  latest: string;
  mandatory: boolean;
  incompatibleFeatures: string[];
  message: string | null;
}

const esquemaVersion = z.object({
  p_plataforma: z.string().trim().min(1, "Plataforma requerida").max(16),
  p_version_actual: z.string().trim().min(1, "Versión requerida").max(40)
});

const esquemaPolitica = z.object({
  current: z.string(),
  minimum: z.string(),
  recommended: z.string(),
  latest: z.string(),
  mandatory: z.boolean(),
  incompatibleFeatures: z.array(z.string()),
  message: z.string().nullable().optional()
});

/**
 * FASE 6 (cierre) — Frontera de versionamiento: la app ya no invoca
 * `obtener_politica_version_app` directamente.
 */
export async function obtenerPoliticaVersionApp(
  cliente: Cliente,
  plataforma: string,
  versionActual: string
): Promise<PoliticaVersionApp | null> {
  const { data, error } = await rpcValidado(cliente, "obtener_politica_version_app", esquemaVersion, {
    p_plataforma: plataforma,
    p_version_actual: versionActual
  });
  if (error) throw error;
  if (data == null) return null;
  const parsed = esquemaPolitica.parse(data as unknown);
  return { ...parsed, message: parsed.message ?? null };
}
