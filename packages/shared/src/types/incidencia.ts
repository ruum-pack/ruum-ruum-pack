// PRD §8 — flujos de incidencia mínimos
export type TipoIncidencia =
  | "vehiculo_no_enciende"
  | "contacto_no_localizado"
  | "documentacion_incompleta"
  | "dano_previo_relevante"
  | "colision_robo_asalto"
  | "emergencia_medica_conductor"
  | "descompostura_en_ruta"
  | "infraccion_autoridad_vial"
  | "conductor_enfermo"
  | "perdida_conectividad"
  | "dano_no_reportado"; // PRD §4.4 — se abre automáticamente al cierre

export type MomentoIncidencia = "recoleccion" | "durante_traslado" | "entrega" | "post_cierre";

// FASE 11 — la incidencia tiene vida propia (severidad, estado, responsable,
// SLA); ya no necesita mover traslados.estado.
export type SeveridadIncidencia = "low" | "medium" | "high" | "critical";

export type EstadoIncidencia = "abierta" | "en_atencion" | "escalada" | "resuelta" | "cerrada";

export interface Incidencia {
  id: string;
  traslado_id: string;
  tipo: TipoIncidencia;
  momento: MomentoIncidencia;
  reportada_por: "usuario" | "conductor" | "admin" | "sistema";
  descripcion: string;
  resuelta: boolean;
  creada_en: string;
  resuelta_en?: string;
  severidad?: SeveridadIncidencia | null;
  estado?: EstadoIncidencia | null;
  responsable_admin_id?: string | null;
  nivel_escalamiento?: number | null;
  sla_horas?: number | null;
  sla_vence_en?: string | null;
}
