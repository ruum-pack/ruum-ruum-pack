// PRD §4.3 + §17 — CONCER = Conductor Certificado Ruum Ruum
export type NivelCONCER = "basico" | "ejecutivo" | "luxury" | "coleccion";

// PRD §4.8 (no presentación), §4.13 (recuperación), §4.1 (pendiente verificación)
export type EstadoConductor =
  | "activo"
  | "suspendido_7d"
  | "suspendido_14d"
  | "suspendido_30d"
  | "suspendido_indefinido"
  | "bloqueado_permanente"
  | "modo_prueba_supervisada"
  | "pendiente_verificacion";

// PRD §4.3 — certificaciones especiales requeridas para Luxury y Colección
export type TipoCertificacion = "vehiculos_luxury" | "vehiculos_coleccion";

export interface Certificacion {
  tipo: TipoCertificacion;
  vigente: boolean;
  vence_en?: string;
}

export interface Conductor {
  id: string;
  nombre: string;
  estado: EstadoConductor;
  // PRD §4.13 — promedio sobre traslados completados en últimos 6 meses,
  // máximo los 100 más recientes dentro de esa ventana
  calificacion_promedio: number;
  traslados_completados: number;
  suspensiones_activas: number;
  // PRD §4.8 — ventana móvil de 6 meses para consecuencias progresivas
  no_presentaciones_6m: number;
  // Decisión de producto (sesión de arquitectura, 2026-06-27) — cancelación
  // activa de un traslado ya aceptado, sin justificación. Infracción distinta
  // de no_presentaciones_6m (ver rules/cancelacion-conductor.ts).
  cancelaciones_sin_justificacion_count: number;
  documentos_vigentes: boolean;
  certificaciones: Certificacion[];
  // PRD §4.3 — "sin incidencias graves" es condición explícita para Ejecutivo (6m) y Luxury (12m)
  incidencias_graves_6m: number;
  incidencias_graves_12m: number;
  creado_en: string;
}

// PRD §4.13 — calificación individual de un traslado, insumo para el promedio móvil
export interface CalificacionTraslado {
  traslado_id: string;
  conductor_id: string;
  estrellas: number; // 1 a 5
  comentario?: string;
  calificado_en: string; // fecha del traslado completado, usada para la ventana de 6 meses
}
