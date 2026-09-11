import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission } from "../../services/permisos-admin";
import { type AlertaSLA, type ExcepcionCriticaAdmin, type TipoSLA } from "../domain/tipos";
import { listarExcepcionesCriticasAdmin } from "./excepciones";

type Cliente = SupabaseClient<Database>;

/**
 * Compatibilidad para contadores legacy: los vencimientos ya vienen calculados
 * por public.admin_sincroniza_alertas_sla_operacionales().
 */
export async function listarAlertasSLA(cliente: Cliente): Promise<AlertaSLA[]> {
  await assertAdminAnyPermission(cliente, ["incidencias:leer", "viajes:leer"]);
  const filas = await listarExcepcionesCriticasAdmin(cliente);
  const tipos: TipoSLA[] = ["cuenta_nueva_usuario", "documentos_usuario", "conductor_primera_vez", "documentos_conductor"];
  return filas.flatMap((alerta) => {
    const fila = alerta as ExcepcionCriticaAdmin & { metadata?: Record<string, unknown> };
    const tipo = typeof fila.metadata?.tipo_alerta === "string" && tipos.includes(fila.metadata.tipo_alerta as TipoSLA)
      ? fila.metadata.tipo_alerta as TipoSLA
      : null;
    if (!tipo) return [];
    return [{
      id: alerta.id,
      tipo,
      nombre: alerta.folioOEntidad,
      creado_en: alerta.creadoEn,
      horas_transcurridas: Math.max((alerta.porcentajeConsumido ?? 0) / 100, 0),
      horas_limite: 1,
      porcentaje_consumido: alerta.porcentajeConsumido ?? 0,
      requiere_alerta: (alerta.porcentajeConsumido ?? 0) >= 80 && (alerta.porcentajeConsumido ?? 0) < 100,
      vencido: (alerta.porcentajeConsumido ?? 0) >= 100
    }];
  });
}
