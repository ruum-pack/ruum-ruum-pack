import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

// FASE 6 (cierre) — Gastos del traslado (conductor): listar, registrar y
// eliminar. La subida del comprobante a Storage sigue en la app (Storage
// API, no PostgREST); la fila vive aquí.

type Cliente = SupabaseClient<Database>;
type GastoRow = Database["public"]["Tables"]["gastos_traslado"]["Row"];

export type GastoTraslado = GastoRow;

const esquemaUuid = z.string().uuid("Debe ser un UUID válido");

const esquemaRegistrar = z.object({
  p_traslado_id: esquemaUuid,
  p_tipo: z.string().trim().min(1, "Tipo requerido").max(60),
  p_monto: z.number().positive("El monto debe ser mayor a cero").max(10000000),
  p_descripcion: z.string().max(500).nullable().optional(),
  p_comprobante_ruta: z.string().max(500).nullable().optional()
});

export async function listarGastosTraslado(cliente: Cliente, trasladoId: string): Promise<GastoRow[]> {
  const { data, error } = await cliente
    .from("gastos_traslado")
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("registrado_en", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GastoRow[];
}

export async function registrarGastoTraslado(
  cliente: Cliente,
  params: {
    trasladoId: string;
    tipo: string;
    monto: number;
    descripcion?: string | null;
    comprobanteRuta?: string | null;
  }
): Promise<GastoRow> {
  const validado = esquemaRegistrar.parse({
    p_traslado_id: params.trasladoId,
    p_tipo: params.tipo,
    p_monto: params.monto,
    p_descripcion: params.descripcion ?? null,
    p_comprobante_ruta: params.comprobanteRuta ?? null
  });
  const { data, error } = await cliente
    .from("gastos_traslado")
    .insert({
      traslado_id: validado.p_traslado_id,
      tipo: validado.p_tipo,
      monto: validado.p_monto,
      descripcion: validado.p_descripcion,
      comprobante_ruta: validado.p_comprobante_ruta
    })
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error("No se pudo registrar el gasto.");
  return data as GastoRow;
}

export async function eliminarGastoTraslado(cliente: Cliente, gastoId: string): Promise<void> {
  esquemaUuid.parse(gastoId);
  const { error } = await cliente.from("gastos_traslado").delete().eq("id", gastoId);
  if (error) throw error;
}
