// PRD §4.4 — ángulos mínimos obligatorios
export type AnguloEvidencia =
  | "frente"
  | "lado_piloto"
  | "lado_copiloto"
  | "trasera"
  | "tablero"
  | "dano_previo"
  | "adicional";

export type TipoEvidencia = "inicial" | "final";

export interface FotoEvidencia {
  id: string;
  traslado_id: string;
  tipo: TipoEvidencia;
  angulo: AnguloEvidencia;
  url?: string; // null/undefined si aún no sincronizada — PRD §4.15
  local_path?: string; // PRD §4.15 — modo offline, almacenamiento local
  timestamp: string;
  lat?: number;
  lng?: number;
  sincronizada: boolean;
}

// PRD §4.4 — los 5 ángulos obligatorios para considerar evidencia completa
// (dano_previo y adicional son condicionales, no obligatorios por defecto)
export const ANGULOS_OBLIGATORIOS: AnguloEvidencia[] = [
  "frente",
  "lado_piloto",
  "lado_copiloto",
  "trasera",
  "tablero"
];
