import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { rpcValidado } from "../services/_rpc-validado";

// FASE 6 (cierre) — Push del conductor: registro de dispositivo, acuse de
// apertura y baja. La app ya no invoca estas RPC directamente.

type Cliente = SupabaseClient<Database>;

const esquemaRegistrar = z.object({
  p_device_id: z.string().trim().min(1, "Dispositivo requerido").max(64),
  p_token_push: z.string().trim().min(1, "Token requerido").max(512),
  p_plataforma: z.string().max(16).optional(),
  p_modelo: z.string().max(120).nullable().optional(),
  p_version_app: z.string().max(40).nullable().optional(),
  p_version_so: z.string().max(40).nullable().optional()
});

const esquemaApertura = z.object({
  p_notificacion_id: z.string().uuid("Debe ser un UUID válido"),
  p_device_id: z.string().trim().min(1, "Dispositivo requerido").max(64)
});

const esquemaBaja = z.object({
  p_device_id: z.string().trim().min(1, "Dispositivo requerido").max(64)
});

export interface RegistroPush {
  deviceId: string;
  tokenPush: string;
  plataforma?: string;
  modelo?: string | null;
  versionApp?: string | null;
  versionSo?: string | null;
}

export async function registrarDispositivoPush(cliente: Cliente, params: RegistroPush): Promise<void> {
  const { error } = await rpcValidado(cliente, "registrar_dispositivo_push", esquemaRegistrar, {
    p_device_id: params.deviceId,
    p_token_push: params.tokenPush,
    p_plataforma: params.plataforma ?? "android",
    p_modelo: params.modelo ?? null,
    p_version_app: params.versionApp ?? null,
    p_version_so: params.versionSo ?? null
  });
  if (error) throw error;
}

export async function registrarAperturaPush(
  cliente: Cliente,
  params: { notificacionId: string; deviceId: string }
): Promise<void> {
  const { error } = await rpcValidado(cliente, "registrar_apertura_push", esquemaApertura, {
    p_notificacion_id: params.notificacionId,
    p_device_id: params.deviceId
  });
  if (error) throw error;
}

export async function desactivarDispositivoPush(cliente: Cliente, deviceId: string): Promise<void> {
  const { error } = await rpcValidado(cliente, "desactivar_dispositivo_push", esquemaBaja, {
    p_device_id: deviceId
  });
  if (error) throw error;
}
