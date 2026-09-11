import type { EstadoAsignacion } from "../types/asignacion";

// FASE 4 — Máquina de estados de Assignment (estados del plan en minúsculas).
// Espejo parcial de public.estado_asignacion; la DB valida con índice único
// parcial (sin doble vigente) y las RPC controlan los saltos.

export const ESTADOS_ASIGNACION: EstadoAsignacion[] = [
  "pendiente",
  "ofrecida",
  "aceptada",
  "rechazada",
  "cancelada",
  "activa",
  "completada"
];

export const ESTADOS_ASIGNACION_VIGENTES: EstadoAsignacion[] = [
  "pendiente",
  "ofrecida",
  "aceptada",
  "activa"
];

export const TRANSICIONES_ASIGNACION: Record<EstadoAsignacion, EstadoAsignacion[]> = {
  pendiente: ["ofrecida", "aceptada", "rechazada", "cancelada"],
  ofrecida: ["aceptada", "rechazada", "cancelada"],
  aceptada: ["activa", "cancelada", "completada"],
  rechazada: [],
  cancelada: [],
  activa: ["completada", "cancelada"],
  completada: []
};

export function esTransicionAsignacionValida(
  actual: EstadoAsignacion,
  siguiente: EstadoAsignacion
): boolean {
  if (actual === siguiente) return true;
  return TRANSICIONES_ASIGNACION[actual]?.includes(siguiente) ?? false;
}

export function esAsignacionVigente(estado: EstadoAsignacion): boolean {
  return ESTADOS_ASIGNACION_VIGENTES.includes(estado);
}
