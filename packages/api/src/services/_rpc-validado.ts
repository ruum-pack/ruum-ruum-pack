import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";

/**
 * ARQ-003 — Helper RPC + Zod
 * Valida args en cliente antes de llamar a Supabase RPC.
 * Evita drift de tipos Database y payloads inválidos hacia Postgres.
 * Si validación falla, lanza ZodError con mensaje en español.
 */
export function validarConEsquema<T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.infer<T> {
  const res = esquema.safeParse(datos);
  if (!res.success) {
    const primer = res.error.issues[0];
    throw new Error(primer ? `${primer.path.join(".")}: ${primer.message}` : "Payload inválido para RPC");
  }
  return res.data;
}

export async function rpcValidado<
  TEsquema extends z.ZodTypeAny,
  TResult = unknown
>(
  cliente: SupabaseClient<Database>,
  nombre: string,
  esquema: TEsquema,
  args: z.infer<TEsquema>
): Promise<{ data: TResult | null; error: unknown | null }> {
  const validado = validarConEsquema(esquema, args);
  const { data, error } = await cliente.rpc(nombre as never, validado as never);
  return { data: data as TResult | null, error };
}

// Esquemas compartidos

export const esquemaUuid = z.string().uuid("Debe ser un UUID válido");

export const esquemaConductorAvanzaTraslado = z.object({
  p_traslado_id: esquemaUuid,
  p_evento: z.enum([
    "conductor_en_camino",
    "llegada_origen",
    "iniciar_verificacion",
    "iniciar_evidencia_inicial",
    "vehiculo_recibido",
    "iniciar_traslado",
    "llegada_destino",
    "iniciar_evidencia_final",
    "confirmar_entrega",
    "cerrar_viaje",
  ], { message: "Evento de conductor inválido" }),
});

export const esquemaConductorAceptaViaje = z.object({
  p_traslado_id: esquemaUuid,
});

export const esquemaGuardarDatosBancarios = z.object({
  p_titular_cuenta: z.string().trim().min(3, "Titular requerido"),
  p_banco: z.string().trim().min(2, "Banco requerido"),
  p_clabe: z.string().regex(/^\d{18}$/, "CLABE debe tener 18 dígitos"),
  p_numero_tarjeta: z.string().trim().nullable().optional(),
});

export const esquemaConductorGuardaBorrador = z.object({
  p_paso_actual: z.number().int().min(0).max(10),
  p_datos_personales: z.unknown(),
  p_domicilio: z.unknown(),
  p_licencia: z.unknown(),
  p_contacto_emergencia: z.unknown(),
});

export const esquemaIniciarSolicitudConductor = z.object({}).strict();

export const esquemaConfirmarLlegadaDestino = z.object({
  p_traslado_id: esquemaUuid,
  p_fuera_geocerca: z.boolean(),
  p_distancia_m: z.number().min(0).nullable().optional(),
});
