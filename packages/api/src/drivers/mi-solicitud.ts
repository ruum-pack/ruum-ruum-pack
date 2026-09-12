import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

// FASE 6 (cierre) — Mi solicitud de conductor: la pantalla de registro ya no
// consulta `solicitudes_conductor`, `documentos_conductor` ni
// `consentimientos_usuario` directamente. Lecturas propias (RLS en servidor).

type Cliente = SupabaseClient<Database>;
type SolicitudRow = Database["public"]["Tables"]["solicitudes_conductor"]["Row"];
type DocumentoRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];
type ConsentimientoRow = Database["public"]["Tables"]["consentimientos_usuario"]["Row"];

export type BorradorSolicitud = Pick<
  SolicitudRow,
  "datos_personales" | "domicilio" | "licencia" | "contacto_emergencia" | "paso_actual"
>;

export type DocumentoSolicitud = Pick<DocumentoRow, "tipo" | "estado" | "es_actual">;

export type ConsentimientoSolicitud = Pick<ConsentimientoRow, "tipo_documento" | "aceptado_en">;

export async function obtenerBorradorSolicitud(
  cliente: Cliente,
  solicitudId: string
): Promise<BorradorSolicitud | null> {
  const { data, error } = await cliente
    .from("solicitudes_conductor")
    .select("datos_personales, domicilio, licencia, contacto_emergencia, paso_actual")
    .eq("id", solicitudId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as BorradorSolicitud | null;
}

export async function listarDocumentosSolicitud(
  cliente: Cliente,
  solicitudId: string
): Promise<DocumentoSolicitud[]> {
  const { data, error } = await cliente
    .from("documentos_conductor")
    .select("tipo,estado,es_actual")
    .eq("solicitud_id", solicitudId)
    .eq("es_actual", true);
  if (error) throw error;
  return ((data ?? []) as DocumentoSolicitud[]);
}

export async function listarConsentimientosSolicitud(
  cliente: Cliente,
  solicitudId: string
): Promise<ConsentimientoSolicitud[]> {
  const { data, error } = await cliente
    .from("consentimientos_usuario")
    .select("tipo_documento,aceptado_en")
    .eq("solicitud_id", solicitudId);
  if (error) throw error;
  return ((data ?? []) as ConsentimientoSolicitud[]);
}
