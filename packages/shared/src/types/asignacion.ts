export type CategoriaPuntualidad = "a" | "b" | "c" | "sin_datos";

export interface ResumenPuntualidad {
  categoria: CategoriaPuntualidad;
  porcentaje: number | null;
  muestra: number;
}

export interface CandidatoAsignacion {
  conductor_id: string;
  puntualidad: ResumenPuntualidad;
  asignaciones_7d: number;
  ultima_asignacion_en: string | null;
  desempate: string;
}

export interface SolicitudAsignacionResultado {
  competencia_id: string;
  traslado_id: string;
  estado: "solicitada" | "ya_solicitada";
  cierra_en: string;
  categoria_puntualidad: CategoriaPuntualidad;
  asignaciones_7d: number;
  viabilidad: "confirmada" | "sin_ubicacion" | "no_aplica";
}

