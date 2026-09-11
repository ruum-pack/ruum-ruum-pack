import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";

type Cliente = SupabaseClient<Database>;
type DisputaRow = Database["public"]["Tables"]["disputas"]["Row"];
type ReclamoSeguroRow = Database["public"]["Tables"]["reclamos_seguro"]["Row"];
type EstadoDisputa = Database["public"]["Enums"]["estado_disputa"];
type ResolucionDisputa = Database["public"]["Enums"]["resolucion_disputa"];
type EstadoReclamoSeguro = Database["public"]["Enums"]["estado_reclamo_seguro"];

export async function listarDisputasAdmin(cliente: Cliente): Promise<DisputaRow[]> {
  await assertAdminPermission(cliente, "disputas:leer");
  const { data, error } = await cliente.from("disputas").select("*").order("abierta_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolverDisputaAdmin(
  cliente: Cliente,
  disputaId: string,
  estado: EstadoDisputa,
  resolucion: ResolucionDisputa | null,
  detalle: string
) {
  await assertAdminPermission(cliente, "disputas:resolver");
  const esEstadoResuelto = estado === "resuelta" || estado === "resuelta_senior";
  if (esEstadoResuelto && !resolucion) {
    throw new Error("Selecciona una resolución para cerrar la disputa.");
  }

  const { error } = await cliente.rpc("admin_resuelve_disputa", {
    p_disputa_id: disputaId,
    p_estado: estado,
    p_resolucion: (esEstadoResuelto ? resolucion : null) as never,
    p_detalle: detalle
  });

  if (error) throw error;
}

export async function listarReclamosSeguroAdmin(cliente: Cliente): Promise<ReclamoSeguroRow[]> {
  await assertAdminPermission(cliente, "reclamos_seguro:leer");
  const { data, error } = await cliente.from("reclamos_seguro").select("*").order("abierto_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function actualizarReclamoSeguroAdmin(
  cliente: Cliente,
  reclamoId: string,
  estado: EstadoReclamoSeguro,
  responsablePago: "aplicacion" | "conductor" | null,
  notasAdmin: string
) {
  await assertAdminPermission(cliente, "reclamos_seguro:gestionar");
  if (estado === "resuelto" && !responsablePago) {
    throw new Error("Selecciona responsable de pago antes de resolver el reclamo.");
  }

  const { error } = await cliente.rpc("admin_actualiza_reclamo_seguro", {
    p_reclamo_id: reclamoId,
    p_estado: estado,
    p_responsable_pago: responsablePago as never,
    p_notas_admin: notasAdmin
  });

  if (error) throw error;
}
