import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

type Cliente = SupabaseClient<Database>;
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];

// FASE 11 — los tipos generados aún no traen las columnas nuevas; se mapean
// desde unknown (misma convención que el resto del paquete ante la deriva).
export interface IncidenciaTorre extends IncidenciaRow {
  severidad: "low" | "medium" | "high" | "critical";
  estado: "abierta" | "en_atencion" | "escalada" | "resuelta" | "cerrada";
  responsable_admin_id: string | null;
  asignada_en: string | null;
  nivel_escalamiento: number;
  escalada_en: string | null;
  sla_horas: number | null;
  sla_vence_en: string | null;
}

export interface MovimientoIncidencia {
  id: string;
  accion: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  actor: string;
  actor_id: string | null;
  motivo: string | null;
  creado_en: string;
}

const esquemaGestion = z.object({
  p_incidencia_id: esquemaUuid,
  p_motivo: z.string().max(2000).nullable().optional(),
  p_severidad: z.enum(["low", "medium", "high", "critical"]).nullable().optional()
});

export async function listarIncidenciasAdmin(cliente: Cliente): Promise<IncidenciaRow[]> {
  await assertAdminPermission(cliente, "incidencias:leer");
  const { data, error } = await cliente.from("incidencias").select("*").order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function mapearTorre(fila: IncidenciaRow): IncidenciaTorre {
  const r = fila as unknown as Record<string, unknown>;
  return {
    ...(fila as object),
    severidad: (r["severidad"] as IncidenciaTorre["severidad"]) ?? "medium",
    estado: (r["estado"] as IncidenciaTorre["estado"]) ?? "abierta",
    responsable_admin_id: (r["responsable_admin_id"] as string | null) ?? null,
    asignada_en: (r["asignada_en"] as string | null) ?? null,
    nivel_escalamiento: Number(r["nivel_escalamiento"] ?? 0),
    escalada_en: (r["escalada_en"] as string | null) ?? null,
    sla_horas: (r["sla_horas"] as number | null) ?? null,
    sla_vence_en: (r["sla_vence_en"] as string | null) ?? null
  } as IncidenciaTorre;
}

export async function listarIncidenciasTorre(cliente: Cliente): Promise<IncidenciaTorre[]> {
  return (await listarIncidenciasAdmin(cliente)).map(mapearTorre);
}

export async function resolverIncidenciaAdmin(
  cliente: Cliente,
  incidenciaId: string,
  motivo?: string | null,
  severidad?: "low" | "medium" | "high" | "critical" | null
): Promise<void> {
  const { error } = await rpcValidado(cliente, "resolver_incidencia", esquemaGestion, {
    p_incidencia_id: incidenciaId,
    p_motivo: motivo ?? null,
    p_severidad: severidad ?? null
  });
  if (error) throw error;
}

export async function asignarIncidenciaAdmin(
  cliente: Cliente,
  incidenciaId: string,
  adminId: string,
  severidad?: "low" | "medium" | "high" | "critical" | null
): Promise<void> {
  const esquema = z.object({ p_incidencia_id: esquemaUuid, p_admin_id: esquemaUuid, p_severidad: esquemaGestion.shape.p_severidad });
  const { error } = await rpcValidado(cliente, "asignar_incidencia", esquema, {
    p_incidencia_id: incidenciaId,
    p_admin_id: adminId,
    p_severidad: severidad ?? null
  });
  if (error) throw error;
}

export async function escalarIncidenciaAdmin(
  cliente: Cliente,
  incidenciaId: string,
  motivo: string
): Promise<void> {
  if (motivo.trim().length < 5) throw new Error("El escalamiento requiere motivo.");
  const { error } = await rpcValidado(
    cliente,
    "escalar_incidencia",
    z.object({ p_incidencia_id: esquemaUuid, p_motivo: z.string().min(5).max(2000) }),
    { p_incidencia_id: incidenciaId, p_motivo: motivo.trim() }
  );
  if (error) throw error;
}

export async function listarHistorialIncidencia(
  cliente: Cliente,
  incidenciaId: string
): Promise<MovimientoIncidencia[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{
            data: MovimientoIncidencia[] | null;
            error: unknown;
          }>;
        };
      };
    };
  })
    .from("incidencia_historial")
    .select("*")
    .eq("incidencia_id", incidenciaId)
    .order("creado_en", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
