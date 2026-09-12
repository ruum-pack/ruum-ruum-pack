import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

// FASE 13 — SLA y motor de alertas: políticas (13.1-13.3), evaluación
// periódica (13.4), cola priorizada de Torre (13.9) y reportes (13.10).
// El cómputo vive en Postgres; aquí solo validación y tipado.

type Cliente = SupabaseClient<Database>;

export const CODIGOS_POLITICA_SLA = [
  "asignacion",
  "recoleccion",
  "entrega",
  "sin_gps",
  "respuesta_incidencia"
] as const;

export type CodigoPoliticaSla = (typeof CODIGOS_POLITICA_SLA)[number];

export interface PoliticaSla {
  codigo: string;
  nombre: string;
  descripcion: string;
  horas_limite: number;
  warning_pct: number;
  severidad: string;
  prioridad_base: number;
  activo: boolean;
}

export interface ResumenEvaluacionSla {
  evaluados: number;
  warnings: number;
  breaches: number;
  recuperados: number;
  evaluado_en: string;
}

export interface ItemColaSla {
  traslado_id: string;
  policy_codigo: string;
  incidencia_id: string | null;
  estado: "warning" | "breach";
  porcentaje: number;
  deadline: string;
  horas_transcurridas: number;
  horas_limite: number;
  prioridad_torre: number;
  severidad: string;
  estado_traslado: string;
  estado_operativo: string | null;
  operacion_id: string | null;
  empresa_id: string | null;
  ultima_evaluacion_en: string;
}

export interface ReporteSla {
  desde: string;
  hasta: string;
  empresa_id: string | null;
  operacion_id: string | null;
  por_politica: Array<{
    policy_codigo: string;
    warnings: number;
    breaches: number;
    recuperados: number;
    traslados_afectados: number;
  }>;
  totales: {
    warnings: number;
    breaches: number;
    recuperados: number;
    traslados_afectados: number;
    eventos: number;
  };
  generado_en: string;
}

const esquemaPolitica = z.object({
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  horas_limite: z.number().positive(),
  warning_pct: z.number().int().min(1).max(99),
  severidad: z.string(),
  prioridad_base: z.number().int().min(1).max(100),
  activo: z.boolean()
});

const esquemaLimite = z.object({ p_limite: z.number().int().min(1).max(5000) });

const esquemaResumen = z.object({
  evaluados: z.number().int().min(0),
  warnings: z.number().int().min(0),
  breaches: z.number().int().min(0),
  recuperados: z.number().int().min(0),
  evaluado_en: z.string()
});

const esquemaItemCola = z.object({
  traslado_id: esquemaUuid,
  policy_codigo: z.string(),
  incidencia_id: esquemaUuid.nullable(),
  estado: z.enum(["warning", "breach"]),
  porcentaje: z.number().int().min(0),
  deadline: z.string(),
  horas_transcurridas: z.number(),
  horas_limite: z.number().positive(),
  prioridad_torre: z.number().int(),
  severidad: z.string(),
  estado_traslado: z.string(),
  estado_operativo: z.string().nullable(),
  operacion_id: esquemaUuid.nullable(),
  empresa_id: esquemaUuid.nullable(),
  ultima_evaluacion_en: z.string()
});

const esquemaCola = z.array(esquemaItemCola);

const esquemaReporte = z.object({
  desde: z.string(),
  hasta: z.string(),
  empresa_id: esquemaUuid.nullable(),
  operacion_id: esquemaUuid.nullable(),
  por_politica: z.array(
    z.object({
      policy_codigo: z.string(),
      warnings: z.number().int().min(0),
      breaches: z.number().int().min(0),
      recuperados: z.number().int().min(0),
      traslados_afectados: z.number().int().min(0)
    })
  ),
  totales: z.object({
    warnings: z.number().int().min(0),
    breaches: z.number().int().min(0),
    recuperados: z.number().int().min(0),
    traslados_afectados: z.number().int().min(0),
    eventos: z.number().int().min(0)
  }),
  generado_en: z.string()
});

const esquemaReporteArgs = z.object({
  p_desde: z.string().datetime({ message: "Desde debe ser fecha ISO" }),
  p_hasta: z.string().datetime({ message: "Hasta debe ser fecha ISO" }),
  p_empresa_id: esquemaUuid.nullable().optional(),
  p_operacion_id: esquemaUuid.nullable().optional()
});

const esquemaColaArgs = z.object({
  p_empresa_id: esquemaUuid.nullable().optional(),
  p_operacion_id: esquemaUuid.nullable().optional(),
  p_limite: z.number().int().min(1).max(500).optional()
});

export async function listarPoliticasSla(cliente: Cliente): Promise<PoliticaSla[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: boolean) => {
          order: (col: string) => Promise<{ data: PoliticaSla[] | null; error: unknown }>;
        };
      };
    };
  })
    .from("sla_policies")
    .select("codigo,nombre,descripcion,horas_limite,warning_pct,severidad,prioridad_base,activo")
    .eq("activo", true)
    .order("codigo");
  if (error) throw error;
  return z.array(esquemaPolitica).parse(data ?? []);
}

export async function evaluarSlaTraslados(
  cliente: Cliente,
  limite = 500
): Promise<ResumenEvaluacionSla> {
  const { data, error } = await rpcValidado(cliente, "sla_evaluar_traslados", esquemaLimite, {
    p_limite: limite
  });
  if (error) throw error;
  if (data == null) throw new Error("Sin respuesta de evaluación SLA.");
  return esquemaResumen.parse(data as unknown);
}

export async function obtenerColaTorreSla(
  cliente: Cliente,
  filtros: { empresaId?: string | null; operacionId?: string | null; limite?: number } = {}
): Promise<ItemColaSla[]> {
  const { data, error } = await rpcValidado(cliente, "admin_sla_cola_torre", esquemaColaArgs, {
    p_empresa_id: filtros.empresaId ?? null,
    p_operacion_id: filtros.operacionId ?? null,
    p_limite: filtros.limite ?? 100
  });
  if (error) throw error;
  if (data == null) return [];
  return esquemaCola.parse(data as unknown);
}

export async function obtenerReporteSla(
  cliente: Cliente,
  params: { desde: string; hasta: string; empresaId?: string | null; operacionId?: string | null }
): Promise<ReporteSla> {
  const { data, error } = await rpcValidado(cliente, "admin_sla_reporte_historico", esquemaReporteArgs, {
    p_desde: params.desde,
    p_hasta: params.hasta,
    p_empresa_id: params.empresaId ?? null,
    p_operacion_id: params.operacionId ?? null
  });
  if (error) throw error;
  if (data == null) throw new Error("No se pudo generar el reporte SLA.");
  return esquemaReporte.parse(data as unknown);
}
