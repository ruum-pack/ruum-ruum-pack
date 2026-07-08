import type { TipoDisputa } from "../types/disputa";

// PRD §4.14 — tipos de disputa
export const ETIQUETA_TIPO_DISPUTA: Record<TipoDisputa, string> = {
  cobro_incorrecto: "Cobro incorrecto",
  cancelacion_fuera_de_politica: "Cancelación fuera de política",
  dano_no_reconocido: "Daño no reconocido",
  no_presentacion: "No presentación",
  calificacion_injusta: "Calificación injusta"
};
