// FASE 1 — Dominio Operation.
// Organization del plan = Empresa existente (ver types/empresa.ts).
// Tabla: public.operaciones (+ traslados.operation_id nullable, compat histórica).

export type TipoOperacion =
  | "corporativa"
  | "flota"
  | "evento"
  | "masiva"
  | "interna";

export type EstadoOperacion =
  | "borrador"
  | "planificada"
  | "en_curso"
  | "pausada"
  | "cerrada"
  | "cancelada";

export type PrioridadOperativa = "baja" | "media" | "alta" | "critica";

export const TRANSICIONES_OPERACION: Record<EstadoOperacion, EstadoOperacion[]> = {
  borrador: ["planificada", "cancelada"],
  planificada: ["en_curso", "cancelada"],
  en_curso: ["pausada", "cerrada", "cancelada"],
  pausada: ["en_curso", "cancelada"],
  cerrada: [],
  cancelada: []
};

export function esTransicionOperacionValida(
  actual: EstadoOperacion,
  siguiente: EstadoOperacion
): boolean {
  if (actual === siguiente) return true;
  return TRANSICIONES_OPERACION[actual]?.includes(siguiente) ?? false;
}

export interface Operacion {
  id: string;
  folio: string;
  empresa_id: string | null;
  nombre: string;
  descripcion?: string | null;
  tipo: TipoOperacion;
  estado: EstadoOperacion;
  prioridad: PrioridadOperativa;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  responsable_interno_admin_id?: string | null;
  cliente_contacto_nombre?: string | null;
  cliente_contacto_telefono?: string | null;
  sla_horas?: number | null;
  metadata?: Record<string, unknown>;
  creado_en: string;
  actualizado_en: string;
}

export interface DatosNuevaOperacion {
  folio?: string;
  empresa_id?: string | null;
  nombre: string;
  descripcion?: string | null;
  tipo?: TipoOperacion;
  prioridad?: PrioridadOperativa;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  responsable_interno_admin_id?: string | null;
  cliente_contacto_nombre?: string | null;
  cliente_contacto_telefono?: string | null;
  sla_horas?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ResumenOperacional {
  operacion_id: string;
  folio: string;
  total_traslados: number;
  por_estado: Record<string, number>;
  con_conductor: number;
  sin_conductor: number;
  con_incidencia_abierta: number;
  avance_pct: number;
}
