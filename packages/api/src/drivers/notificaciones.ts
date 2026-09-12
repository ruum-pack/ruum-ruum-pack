import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

// FASE 6 (cierre) — Centro de notificaciones del conductor: la app ya no
// consulta `notificaciones_conductor` ni invoca `marcar_notificacion_leida`
// directamente; toda la frontera vive aquí.

type Cliente = SupabaseClient<Database>;
type Fila = Database["public"]["Tables"]["notificaciones_conductor"]["Row"];

export interface NotificacionConductor {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  destino: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  leida_en: string | null;
  estado: string;
  creado_en: string;
}

const COLUMNAS =
  "id,tipo,titulo,cuerpo,destino,entidad_tipo,entidad_id,leida_en,estado,creado_en";

const esquemaNotificacion = z.object({
  id: esquemaUuid,
  tipo: z.string(),
  titulo: z.string(),
  cuerpo: z.string(),
  destino: z.string(),
  entidad_tipo: z.string().nullable(),
  entidad_id: esquemaUuid.nullable(),
  leida_en: z.string().nullable(),
  estado: z.string(),
  creado_en: z.string()
});

const esquemaMarcar = z.object({ p_notificacion_id: esquemaUuid });

function aNotificacion(fila: Fila): NotificacionConductor {
  return esquemaNotificacion.parse({
    id: fila.id,
    tipo: fila.tipo,
    titulo: fila.titulo,
    cuerpo: fila.cuerpo,
    destino: fila.destino,
    entidad_tipo: fila.entidad_tipo,
    entidad_id: fila.entidad_id,
    leida_en: fila.leida_en,
    estado: fila.estado,
    creado_en: fila.creado_en
  });
}

export async function listarNotificacionesConductor(
  cliente: Cliente,
  limite = 100
): Promise<NotificacionConductor[]> {
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) {
    throw new Error("Límite de notificaciones inválido.");
  }
  const { data, error } = await cliente
    .from("notificaciones_conductor")
    .select(COLUMNAS)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Fila[]).map(aNotificacion);
}

export async function contarNotificacionesNoLeidas(cliente: Cliente): Promise<number> {
  const { count, error } = await cliente
    .from("notificaciones_conductor")
    .select("id", { count: "exact", head: true })
    .is("leida_en", null);
  if (error) throw error;
  return count ?? 0;
}

export async function marcarNotificacionLeida(cliente: Cliente, notificacionId: string): Promise<void> {
  const { error } = await rpcValidado(cliente, "marcar_notificacion_leida", esquemaMarcar, {
    p_notificacion_id: notificacionId
  });
  if (error) throw error;
}
