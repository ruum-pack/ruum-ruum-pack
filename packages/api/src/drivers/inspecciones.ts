import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

// FASE 6 (cierre) — Inspecciones operativas del traslado (conductor):
// lectura y guardado idempotente por (traslado, tipo). El guardado usa
// onConflict traslado_id,tipo: reintentar no duplica (Evidencia:idempotencia).

type Cliente = SupabaseClient<Database>;
type InspeccionRow = Database["public"]["Tables"]["evidencia_inspecciones"]["Row"];
type TipoInspeccion = Database["public"]["Enums"]["tipo_evidencia"];

export type InspeccionTraslado = InspeccionRow;

const esquemaGuardar = z.object({
  traslado_id: z.string().uuid("Debe ser un UUID válido"),
  tipo: z.enum(["inicial", "final"]),
  combustible: z.string().max(60).nullable().optional(),
  kilometraje: z.number().min(0).nullable().optional(),
  llaves_recibidas: z.string().max(60).nullable().optional(),
  holograma_verificacion: z.boolean().nullable().optional(),
  talon_verificacion: z.string().max(120).nullable().optional(),
  tarjeta_circulacion: z.string().max(120).nullable().optional(),
  placa_delantera: z.string().max(20).nullable().optional(),
  placa_trasera: z.string().max(20).nullable().optional(),
  notas: z.string().max(1000).nullable().optional()
});

export type DatosInspeccion = z.infer<typeof esquemaGuardar>;

export async function listarInspeccionesTraslado(
  cliente: Cliente,
  trasladoId: string
): Promise<InspeccionRow[]> {
  const { data, error } = await cliente
    .from("evidencia_inspecciones")
    .select("*")
    .eq("traslado_id", trasladoId);
  if (error) throw error;
  return (data ?? []) as InspeccionRow[];
}

export async function obtenerInspeccionTraslado(
  cliente: Cliente,
  trasladoId: string,
  tipo: TipoInspeccion
): Promise<InspeccionRow | null> {
  const { data, error } = await cliente
    .from("evidencia_inspecciones")
    .select("*")
    .eq("traslado_id", trasladoId)
    .eq("tipo", tipo)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as InspeccionRow | null;
}

export async function guardarInspeccionTraslado(
  cliente: Cliente,
  datos: DatosInspeccion
): Promise<void> {
  const validado = esquemaGuardar.parse(datos);
  const { error } = await cliente
    .from("evidencia_inspecciones")
    .upsert(
      {
        traslado_id: validado.traslado_id,
        tipo: validado.tipo,
        combustible: validado.combustible ?? null,
        kilometraje: validado.kilometraje ?? null,
        llaves_recibidas: validado.llaves_recibidas ?? null,
        holograma_verificacion: validado.holograma_verificacion ?? null,
        talon_verificacion: validado.talon_verificacion ?? null,
        tarjeta_circulacion: validado.tarjeta_circulacion ?? null,
        placa_delantera: validado.placa_delantera ?? null,
        placa_trasera: validado.placa_trasera ?? null,
        notas: validado.notas ?? null
      },
      { onConflict: "traslado_id,tipo" }
    );
  if (error) throw error;
}
