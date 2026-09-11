import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import type { Asignacion } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "./_rpc-validado";

// FASE 4 — Assignment: ofrecer/aceptar/rechazar/cancelar/reasignar + historial.
// Escrituras vía RPC auditables; traslados.conductor_id sigue como puntero.

type Cliente = SupabaseClient<Database>;

const TABLA = "asignaciones" as never;

const esquemaOfrecer = z.object({
  p_traslado_id: esquemaUuid,
  p_conductor_id: esquemaUuid,
  p_motivo: z.string().max(500).nullable().optional()
});

const esquemaPorId = z.object({
  p_asignacion_id: esquemaUuid
});

const esquemaRechazar = z.object({
  p_asignacion_id: esquemaUuid,
  p_motivo: z.string().max(500).nullable().optional()
});

const esquemaCancelar = esquemaRechazar;

const esquemaReasignar = z.object({
  p_traslado_id: esquemaUuid,
  p_nuevo_conductor_id: esquemaUuid,
  p_motivo: z.string().max(500).nullable().optional()
});

export async function ofrecerAsignacion(
  cliente: Cliente,
  trasladoId: string,
  conductorId: string,
  motivo?: string | null
): Promise<string> {
  const { data, error } = await rpcValidado(cliente, "ofrecer_asignacion", esquemaOfrecer, {
    p_traslado_id: trasladoId,
    p_conductor_id: conductorId,
    p_motivo: motivo ?? null
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo ofrecer la asignación.");
  return data as unknown as string;
}

export async function aceptarAsignacion(cliente: Cliente, asignacionId: string): Promise<void> {
  const { error } = await rpcValidado(cliente, "aceptar_asignacion", esquemaPorId, {
    p_asignacion_id: asignacionId
  });
  if (error) throw error;
}

export async function rechazarAsignacion(
  cliente: Cliente,
  asignacionId: string,
  motivo?: string | null
): Promise<void> {
  const { error } = await rpcValidado(cliente, "rechazar_asignacion", esquemaRechazar, {
    p_asignacion_id: asignacionId,
    p_motivo: motivo ?? null
  });
  if (error) throw error;
}

export async function cancelarAsignacion(
  cliente: Cliente,
  asignacionId: string,
  motivo?: string | null
): Promise<void> {
  const { error } = await rpcValidado(cliente, "cancelar_asignacion", esquemaCancelar, {
    p_asignacion_id: asignacionId,
    p_motivo: motivo ?? null
  });
  if (error) throw error;
}

export async function reasignarConductor(
  cliente: Cliente,
  trasladoId: string,
  nuevoConductorId: string,
  motivo?: string | null
): Promise<string> {
  const { data, error } = await rpcValidado(cliente, "reasignar_conductor", esquemaReasignar, {
    p_traslado_id: trasladoId,
    p_nuevo_conductor_id: nuevoConductorId,
    p_motivo: motivo ?? null
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo reasignar.");
  return data as unknown as string;
}

export async function listarHistorialAsignaciones(
  cliente: Cliente,
  trasladoId: string
): Promise<Asignacion[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: never) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{
            data: Asignacion[] | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .from(TABLA)
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("creado_en", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
