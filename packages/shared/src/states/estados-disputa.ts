import type { EstadoDisputa } from "../types/disputa";

export const ETIQUETA_ESTADO_DISPUTA: Record<EstadoDisputa, string> = {
  abierta: "Abierta",
  en_revision: "En revisión",
  resuelta: "Resuelta",
  escalada: "Escalada a Admin senior",
  resuelta_senior: "Resuelta por Admin senior (definitiva)"
};

// PRD §4.14 — abierta -> en_revision -> resuelta -> (si no se acepta) escalada -> resuelta_senior
export const TRANSICIONES_DISPUTA: Record<EstadoDisputa, EstadoDisputa[]> = {
  abierta: ["en_revision"],
  en_revision: ["resuelta"],
  resuelta: ["escalada"],
  escalada: ["resuelta_senior"],
  resuelta_senior: []
};
