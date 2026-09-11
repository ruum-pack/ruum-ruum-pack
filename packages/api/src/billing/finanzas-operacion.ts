import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

// FASE 12 — Finanzas por operación: agregados de facturado/costo/gastos/
// comisiones/margen + traslados sin pago. El cómputo vive en
// admin_finanzas_operacion (12.12); aquí solo validación y tipado.

type Cliente = SupabaseClient<Database>;

export interface FinanzasOperacion {
  operacion_id: string;
  traslados: number;
  facturado: number;
  costo_conductor: number;
  gastos_directos: number;
  comisiones: number;
  margen_contribucion: number;
  traslados_sin_pago: string[];
}

const esquemaOperacion = z.object({ p_operacion_id: esquemaUuid });

const esquemaFinanzas = z.object({
  operacion_id: esquemaUuid,
  traslados: z.number().int().min(0),
  facturado: z.number().min(0),
  costo_conductor: z.number().min(0),
  gastos_directos: z.number().min(0),
  comisiones: z.number().min(0),
  margen_contribucion: z.number(),
  traslados_sin_pago: z.array(esquemaUuid)
});

export async function obtenerFinanzasOperacion(
  cliente: Cliente,
  operacionId: string
): Promise<FinanzasOperacion> {
  const { data, error } = await rpcValidado(cliente, "admin_finanzas_operacion", esquemaOperacion, {
    p_operacion_id: operacionId
  });
  if (error) throw error;
  if (data == null) throw new Error("No se pudieron obtener las finanzas de la operación.");
  return esquemaFinanzas.parse(data as unknown);
}
