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
}
