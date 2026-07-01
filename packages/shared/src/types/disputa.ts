// PRD §4.14 — tipos de disputa
export type TipoDisputa =
  | "cobro_incorrecto"
  | "cancelacion_fuera_de_politica"
  | "dano_no_reconocido"
  | "no_presentacion"
  | "calificacion_injusta";

export type EstadoDisputa = "abierta" | "en_revision" | "resuelta" | "escalada" | "resuelta_senior";

export type ResolucionDisputa = "favor_reclamante" | "en_contra" | "solucion_parcial";

export interface Disputa {
  id: string;
  traslado_id: string;
  abierta_por: "usuario" | "conductor";
  tipo: TipoDisputa;
  estado: EstadoDisputa;
  resolucion?: ResolucionDisputa;
  abierta_en: string; // máx 72h post-cierre — PRD §4.14
  resuelta_en?: string; // SLA 5 días hábiles (10 si escala) — PRD §4.14
  escalada_en?: string; // ventana de 48h para escalar tras resolución
}
