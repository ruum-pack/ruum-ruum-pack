import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@ruum/shared/types";
import { assertAdminPermission, type PermisoAdmin } from "./permisos-admin";
import { normalizarError } from "./errores";

type Cliente = SupabaseClient<Database>;
export type TipoAprobacion = "finanzas" | "sancion" | "tarifas";
export type SolicitudAprobacionAdmin = {
  id: string; tipo: TipoAprobacion; capacidad_requerida: string; recurso: string; recurso_id: string | null;
  accion: string; payload: Json; estado: "pendiente"|"aprobada"|"rechazada"|"ejecutada"|"expirada";
  solicitada_por: string; aprobada_por: string|null; motivo_decision: string|null; creada_en: string; expira_en: string; version: number;
};

export async function solicitarAprobacionAdmin(cliente: Cliente, entrada: {
  tipo: TipoAprobacion; capacidad: PermisoAdmin; recurso: string; recursoId?: string; accion: string; payload?: Json;
}) {
  await assertAdminPermission(cliente, entrada.capacidad);
  const { data, error } = await cliente.rpc("admin_solicitar_aprobacion", {
    p_tipo: entrada.tipo, p_capacidad: entrada.capacidad, p_recurso: entrada.recurso,
    p_recurso_id: entrada.recursoId ?? "", p_accion: entrada.accion, p_payload: entrada.payload ?? {}
  });
  if (error) throw normalizarError(error);
  if (!data) throw new Error("No se pudo crear la solicitud de aprobación.");
  return data;
}

export async function listarAprobacionesPendientes(cliente: Cliente): Promise<SolicitudAprobacionAdmin[]> {
  await assertAdminPermission(cliente, "aprobaciones:aprobar");
  const { data, error } = await cliente.from("solicitudes_aprobacion_admin").select("*").eq("estado","pendiente").order("creada_en",{ascending:false}).limit(100);
  if (error) throw normalizarError(error);
  return (data ?? []) as SolicitudAprobacionAdmin[];
}

export async function decidirAprobacionAdmin(cliente: Cliente, id:string, aprobar:boolean, motivo:string, version:number) {
  await assertAdminPermission(cliente, "aprobaciones:aprobar");
  const { error } = await cliente.rpc("admin_decidir_aprobacion", {p_solicitud_id:id,p_aprobar:aprobar,p_motivo:motivo,p_version_esperada:version});
  if (error) throw normalizarError(error);
}
