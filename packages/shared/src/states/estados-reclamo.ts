import type { EstadoReclamoSeguro } from "../types/seguro";

export const ETIQUETA_ESTADO_RECLAMO: Record<EstadoReclamoSeguro, string> = {
  abierto: "Abierto",
  en_revision: "En revisión",
  resuelto: "Resuelto"
};

// PRD §4.9 — "El usuario ve el estatus del reclamo dentro del Pasaporte
// Digital (abierto, en revisión, resuelto)."
export const TRANSICIONES_RECLAMO: Record<EstadoReclamoSeguro, EstadoReclamoSeguro[]> = {
  abierto: ["en_revision", "resuelto"],
  en_revision: ["resuelto"],
  resuelto: []
};
