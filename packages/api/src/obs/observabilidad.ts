import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

// FASE 14 — Observabilidad y auditoría: correlation ID, logs, latencias,
// edge errors, tracking, cola offline, dashboards, purgas y métricas.
// El cómputo vive en Postgres; aquí solo validación y tipado.

type Cliente = SupabaseClient<Database>;

export type NivelObs = "info" | "warn" | "error";

export interface ResumenTrackingFallo {
  traslado_id: string;
  estado_traslado: string;
  estado_operativo: string | null;
  conductor_id: string | null;
  operacion_id: string | null;
  empresa_id: string | null;
  ultimo_envio_en: string | null;
  minutos_sin_senal: number | null;
  salud: "OFFLINE" | "STALE" | "OK";
  sin_sesion_activa: boolean;
  desviacion_sospechosa: boolean;
}

export interface DashboardObs {
  desde: string;
  hasta: string;
  logs_por_nivel: { info: number; warn: number; error: number };
  rpc_lentas: Array<{ funcion: string; llamadas: number; errores: number; p95_ms: number | null }>;
  edge_errores: Array<{ funcion: string; codigo: string; total: number }>;
  eventos_app: Array<{ tipo: string; total: number }>;
  tracking_fallos_actuales: number;
  generado_en: string;
}

export interface MetricasNegocio {
  desde: string;
  hasta: string;
  empresa_id: string | null;
  operacion_id: string | null;
  time_to_assign_horas: number | null;
  pickup_on_time_rate: number | null;
  delivery_on_time_rate: number | null;
  average_transfer_duration_horas: number | null;
  tracking_uptime: number | null;
  incident_rate: number | null;
  claim_rate: number | null;
  driver_acceptance_rate: number | null;
  evidence_completion_rate: number | null;
  operation_margin: {
    facturado: number;
    costo_conductor: number;
    gastos_directos: number;
    comisiones: number;
    margen_contribucion: number;
  };
  generado_en: string;
}

const esquemaRango = z.object({
  p_desde: z.string().datetime({ message: "Desde debe ser fecha ISO" }),
  p_hasta: z.string().datetime({ message: "Hasta debe ser fecha ISO" })
});

const esquemaAlcance = esquemaRango.extend({
  p_empresa_id: esquemaUuid.nullable().optional(),
  p_operacion_id: esquemaUuid.nullable().optional()
});

const esquemaTrackingFallo = z.object({
  traslado_id: esquemaUuid,
  estado_traslado: z.string(),
  estado_operativo: z.string().nullable(),
  conductor_id: esquemaUuid.nullable(),
  operacion_id: esquemaUuid.nullable(),
  empresa_id: esquemaUuid.nullable(),
  ultimo_envio_en: z.string().nullable(),
  minutos_sin_senal: z.number().int().nullable(),
  salud: z.enum(["OFFLINE", "STALE", "OK"]),
  sin_sesion_activa: z.boolean(),
  desviacion_sospechosa: z.boolean()
});

const esquemaDashboard = z.object({
  desde: z.string(),
  hasta: z.string(),
  logs_por_nivel: z.object({
    info: z.number().int().min(0),
    warn: z.number().int().min(0),
    error: z.number().int().min(0)
  }),
  rpc_lentas: z.array(
    z.object({
      funcion: z.string(),
      llamadas: z.number().int().min(0),
      errores: z.number().int().min(0),
      p95_ms: z.number().int().nullable()
    })
  ),
  edge_errores: z.array(
    z.object({ funcion: z.string(), codigo: z.string(), total: z.number().int().min(0) })
  ),
  eventos_app: z.array(z.object({ tipo: z.string(), total: z.number().int().min(0) })),
  tracking_fallos_actuales: z.number().int().min(0),
  generado_en: z.string()
});

const esquemaMetricas = z.object({
  desde: z.string(),
  hasta: z.string(),
  empresa_id: esquemaUuid.nullable(),
  operacion_id: esquemaUuid.nullable(),
  time_to_assign_horas: z.number().nullable(),
  pickup_on_time_rate: z.number().min(0).max(1).nullable(),
  delivery_on_time_rate: z.number().min(0).max(1).nullable(),
  average_transfer_duration_horas: z.number().nullable(),
  tracking_uptime: z.number().min(0).max(1).nullable(),
  incident_rate: z.number().min(0).max(1).nullable(),
  claim_rate: z.number().min(0).max(1).nullable(),
  driver_acceptance_rate: z.number().min(0).max(1).nullable(),
  evidence_completion_rate: z.number().min(0).max(1).nullable(),
  operation_margin: z.object({
    facturado: z.number(),
    costo_conductor: z.number(),
    gastos_directos: z.number(),
    comisiones: z.number(),
    margen_contribucion: z.number()
  }),
  generado_en: z.string()
});

const esquemaLatencia = z.object({
  p_funcion: z.string().trim().min(1, "Función requerida").max(120),
  p_duracion_ms: z.number().int().min(0).max(3600000),
  p_ok: z.boolean().optional(),
  p_codigo_error: z.string().max(40).nullable().optional(),
  p_correlation_id: z.string().max(64).nullable().optional(),
  p_traslado_id: esquemaUuid.nullable().optional()
});

const esquemaLog = z.object({
  p_nivel: z.enum(["info", "warn", "error"]),
  p_servicio: z.string().trim().min(1, "Servicio requerido").max(80),
  p_nombre: z.string().trim().min(1, "Nombre requerido").max(120),
  p_correlation_id: z.string().max(64).nullable().optional(),
  p_traslado_id: esquemaUuid.nullable().optional(),
  p_operacion_id: esquemaUuid.nullable().optional(),
  p_usuario_id: esquemaUuid.nullable().optional(),
  p_duracion_ms: z.number().int().min(0).max(3600000).nullable().optional(),
  p_datos: z.unknown().optional()
});

const esquemaLimite = z.object({ p_limite: z.number().int().min(1).max(500) });

const esquemaPurga = z.object({
  p_tabla: z.enum([
    "obs_rpc_latency",
    "obs_edge_errors",
    "eventos_operativos_app",
    "eventos_observabilidad",
    "registro_auditoria"
  ]),
  p_limite: z.number().int().min(1).max(50000).optional()
});

/** 14.2 — genera un correlation ID (UUID v4) para una operación. */
export function nuevoCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** 14.1 — log centralizado server-side (Torre/service). */
export async function registrarLogObs(
  cliente: Cliente,
  params: {
    nivel: NivelObs;
    servicio: string;
    nombre: string;
    correlationId?: string | null;
    trasladoId?: string | null;
    operacionId?: string | null;
    usuarioId?: string | null;
    duracionMs?: number | null;
    datos?: unknown;
  }
): Promise<number> {
  const { data, error } = await rpcValidado(cliente, "obs_registrar_log", esquemaLog, {
    p_nivel: params.nivel,
    p_servicio: params.servicio,
    p_nombre: params.nombre,
    p_correlation_id: params.correlationId ?? null,
    p_traslado_id: params.trasladoId ?? null,
    p_operacion_id: params.operacionId ?? null,
    p_usuario_id: params.usuarioId ?? null,
    p_duracion_ms: params.duracionMs ?? null,
    p_datos: (params.datos ?? {}) as never
  });
  if (error) throw error;
  if (data == null) throw new Error("Sin respuesta de log.");
  return z.number().parse(data as unknown);
}

/** 14.6 — reporta latencia de un RPC medida por la app. */
export async function registrarLatenciaRpc(
  cliente: Cliente,
  params: {
    funcion: string;
    duracionMs: number;
    ok?: boolean;
    codigoError?: string | null;
    correlationId?: string | null;
    trasladoId?: string | null;
  }
): Promise<number> {
  const { data, error } = await rpcValidado(cliente, "obs_registrar_latencia_rpc", esquemaLatencia, {
    p_funcion: params.funcion,
    p_duracion_ms: params.duracionMs,
    p_ok: params.ok ?? true,
    p_codigo_error: params.codigoError ?? null,
    p_correlation_id: params.correlationId ?? null,
    p_traslado_id: params.trasladoId ?? null
  });
  if (error) throw error;
  if (data == null) throw new Error("Sin respuesta de latencia.");
  return z.number().parse(data as unknown);
}

/** 14.8 — fallos de tracking ordenados para Torre (OFFLINE primero). */
export async function obtenerTrackingFallos(
  cliente: Cliente,
  limite = 100
): Promise<ResumenTrackingFallo[]> {
  const { data, error } = await rpcValidado(cliente, "admin_obs_tracking_fallos", esquemaLimite, {
    p_limite: limite
  });
  if (error) throw error;
  if (data == null) return [];
  return z.array(esquemaTrackingFallo).parse(data as unknown);
}

/** 14.10 — panel único de observabilidad para Torre. */
export async function obtenerDashboardObs(
  cliente: Cliente,
  params: { desde: string; hasta: string }
): Promise<DashboardObs> {
  const { data, error } = await rpcValidado(cliente, "admin_obs_dashboard", esquemaRango, {
    p_desde: params.desde,
    p_hasta: params.hasta
  });
  if (error) throw error;
  if (data == null) throw new Error("No se pudo generar el dashboard.");
  return esquemaDashboard.parse(data as unknown);
}

/** Métricas de negocio (time_to_assign… operation_margin). */
export async function obtenerMetricasNegocio(
  cliente: Cliente,
  params: { desde: string; hasta: string; empresaId?: string | null; operacionId?: string | null }
): Promise<MetricasNegocio> {
  const { data, error } = await rpcValidado(
    cliente,
    "admin_obs_metricas_negocio",
    esquemaAlcance,
    {
      p_desde: params.desde,
      p_hasta: params.hasta,
      p_empresa_id: params.empresaId ?? null,
      p_operacion_id: params.operacionId ?? null
    }
  );
  if (error) throw error;
  if (data == null) throw new Error("No se pudieron calcular las métricas.");
  return esquemaMetricas.parse(data as unknown);
}

/** 14.12 — purga por política de retención (solo dirección). */
export async function purgarObservabilidad(
  cliente: Cliente,
  params: {
    tabla:
      | "obs_rpc_latency"
      | "obs_edge_errors"
      | "eventos_operativos_app"
      | "eventos_observabilidad"
      | "registro_auditoria";
    limite?: number;
  }
): Promise<{ tabla: string; eliminados: number; dias: number }> {
  const { data, error } = await rpcValidado(cliente, "admin_obs_purgar", esquemaPurga, {
    p_tabla: params.tabla,
    p_limite: params.limite ?? 5000
  });
  if (error) throw error;
  if (data == null) throw new Error("Sin respuesta de purga.");
  return z
    .object({ tabla: z.string(), eliminados: z.number().int().min(0), dias: z.number().int() })
    .parse(data as unknown);
}
