import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "../../services/permisos-admin";

// FASE 6 (cierre) — Frontera de auditoría de seguridad: las routes de
// panel-admin ya no consultan `auditoria_admin_seguridad` ni
// `exportaciones_admin` directamente.

type Cliente = SupabaseClient<Database>;
type EventoRow = Database["public"]["Tables"]["auditoria_admin_seguridad"]["Row"];
type ExportacionRow = Database["public"]["Tables"]["exportaciones_admin"]["Row"];

export interface FiltrosAuditoriaSeguridad {
  page?: number;
  pageSize?: number;
  tipo?: string;
  busqueda?: string;
}

export interface PaginaAuditoriaSeguridad {
  eventos: EventoRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listarAuditoriaSeguridad(
  cliente: Cliente,
  filtros: FiltrosAuditoriaSeguridad = {}
): Promise<PaginaAuditoriaSeguridad> {
  await assertAdminPermission(cliente, "auditoria:leer");
  const page = Math.max(1, Math.floor(filtros.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(filtros.pageSize ?? 20)));
  const tipo = (filtros.tipo ?? "").trim();
  const busqueda = (filtros.busqueda ?? "").trim();

  let query = cliente.from("auditoria_admin_seguridad").select("*", { count: "exact" });
  if (tipo && tipo !== "todas") {
    query = tipo === "denegado" ? query.ilike("tipo", "%denegado%") : query.eq("tipo", tipo);
  }
  if (busqueda) {
    const q = `%${busqueda}%`;
    query = query.or(`recurso.ilike.${q},accion.ilike.${q},rol.ilike.${q},motivo.ilike.${q}`);
  }
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("creado_en", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { eventos: (data ?? []) as EventoRow[], total: count ?? 0, page, pageSize };
}

export async function listarExportacionesAdmin(
  cliente: Cliente,
  limite = 50
): Promise<{ exportaciones: ExportacionRow[]; total: number }> {
  await assertAdminPermission(cliente, "auditoria:leer");
  const top = Math.min(200, Math.max(1, Math.floor(limite)));
  const { data, error, count } = await cliente
    .from("exportaciones_admin")
    .select("*", { count: "exact" })
    .order("creada_en", { ascending: false })
    .limit(top);
  if (error) throw error;
  return { exportaciones: (data ?? []) as ExportacionRow[], total: count ?? 0 };
}
