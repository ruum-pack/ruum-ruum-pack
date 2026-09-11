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

// FASE 4 — Assignment formal (public.asignaciones). Origen manual incluye
// Torre y dispatcher; competencia conserva el puntaje CONCER.

export type EstadoAsignacion =
  | "pendiente"
  | "ofrecida"
  | "aceptada"
  | "rechazada"
  | "cancelada"
  | "activa"
  | "completada";

export type OrigenAsignacion = "manual" | "competencia" | "sistema" | "reasignacion";

export interface Asignacion {
  id: string;
  traslado_id: string;
  conductor_id: string;
  estado: EstadoAsignacion;
  origen: OrigenAsignacion;
  puntaje?: number | null;
  motivo?: string | null;
  gestionada_por?: string | null;
  metadata?: Record<string, unknown>;
  asignada_en: string;
  ofrecida_en?: string | null;
  aceptada_en?: string | null;
  rechazada_en?: string | null;
  iniciada_en?: string | null;
  completada_en?: string | null;
  cancelada_en?: string | null;
  creado_en: string;
  actualizado_en: string;
}

