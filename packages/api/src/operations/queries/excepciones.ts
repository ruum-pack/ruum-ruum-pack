import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "../../services/permisos-admin";
import {
  type CategoriaExcepcionCritica,
  type ExcepcionCriticaAdmin,
  type SeveridadExcepcionCritica
} from "../domain/tipos";

type Cliente = SupabaseClient<Database>;

type AlertaSlaOperacionalRow = {
  id: string;
  categoria: CategoriaExcepcionCritica;
  severidad: SeveridadExcepcionCritica;
  estado: ExcepcionCriticaAdmin["estado"];
  prioridad: number;
  entidad_tipo: string;
  entidad_id: string;
  traslado_id: string | null;
  folio: string;
  descripcion: string;
  origen_creado_en: string;
  vence_en: string | null;
  sla_restante_horas: number | null;
  horas_transcurridas: number | null;
  horas_limite: number | null;
  porcentaje_consumido: number | null;
  responsable: string | null;
  notificacion_estado: string | null;
  metadata: Record<string, unknown>;
  creado_en: string;
  actualizado_en: string;
};

export async function listarExcepcionesCriticasAdmin(cliente: Cliente): Promise<ExcepcionCriticaAdmin[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_sincroniza_alertas_sla_operacionales",
    args?: Record<string, never>
  ) => Promise<{ data: AlertaSlaOperacionalRow[] | null; error: Error | null }>;
  const { data, error } = await rpc("admin_sincroniza_alertas_sla_operacionales");
  if (error) throw error;
  return (data ?? []).map((alerta) => ({
    id: alerta.id,
    categoria: alerta.categoria,
    severidad: alerta.severidad,
    estado: alerta.estado,
    prioridad: alerta.prioridad,
    folioOEntidad: alerta.folio,
    descripcion: alerta.descripcion,
    creadoEn: alerta.origen_creado_en,
    actualizadoEn: alerta.actualizado_en,
    venceEn: alerta.vence_en,
    responsable: alerta.responsable,
    slaRestanteHoras: alerta.sla_restante_horas,
    porcentajeConsumido: alerta.porcentaje_consumido,
    notificacionEstado: alerta.notificacion_estado,
    metadata: alerta.metadata,
    accionPrincipal: accionPrincipalAlerta(alerta),
    accionEscalamiento: {
      etiqueta: "Escalar",
      href: alerta.traslado_id ? `/viajes/${alerta.traslado_id}` : "/alertas-sla"
    }
  }));
}

function accionPrincipalAlerta(alerta: AlertaSlaOperacionalRow) {
  if (alerta.traslado_id) return { etiqueta: "Abrir traslado", href: `/viajes/${alerta.traslado_id}` };
  if (alerta.entidad_tipo === "usuario") return { etiqueta: "Revisar usuario", href: "/usuarios" };
  if (alerta.entidad_tipo === "conductor") return { etiqueta: "Revisar conductor", href: "/conductores" };
  if (alerta.entidad_tipo === "incidencia") return { etiqueta: "Atender incidencia", href: "/incidencias?filtro=abiertas" };
  return { etiqueta: "Revisar alerta", href: "/alertas-sla" };
}
