import type { TipoIncidencia } from "../types/incidencia";

// PRD §8 — flujos de incidencia mínimos
export const ETIQUETA_TIPO_INCIDENCIA: Record<TipoIncidencia, string> = {
  vehiculo_no_enciende: "Vehículo no enciende",
  contacto_no_localizado: "Usuario/contacto no localizado",
  documentacion_incompleta: "Documentación incompleta o no coincide",
  dano_previo_relevante: "Daño previo relevante",
  colision_robo_asalto: "Colisión, robo o asalto",
  emergencia_medica_conductor: "Emergencia médica del conductor",
  descompostura_en_ruta: "Descompostura en ruta",
  infraccion_autoridad_vial: "Infracción por autoridad vial",
  conductor_enfermo: "Conductor enfermo",
  perdida_conectividad: "Pérdida de conectividad",
  dano_no_reportado: "Daño no reportado"
};

export type PrioridadSoporte = "alta" | "media" | "baja";

// PRD §13 — "Clasificar casos en alta, media y baja prioridad para torre de control."
// El PRD no fija la matriz tipo->prioridad explícitamente; esta es la
// clasificación operativa razonable derivada de §4.5 (eventos críticos) y §8.
export const PRIORIDAD_POR_INCIDENCIA: Record<TipoIncidencia, PrioridadSoporte> = {
  colision_robo_asalto: "alta",
  emergencia_medica_conductor: "alta",
  conductor_enfermo: "alta",
  descompostura_en_ruta: "media",
  infraccion_autoridad_vial: "media",
  perdida_conectividad: "media",
  vehiculo_no_enciende: "media",
  contacto_no_localizado: "media",
  documentacion_incompleta: "baja",
  dano_previo_relevante: "baja",
  dano_no_reportado: "baja"
};
