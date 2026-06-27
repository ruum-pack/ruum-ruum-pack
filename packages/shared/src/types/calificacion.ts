import type { NivelCONCER } from "./conductor";

// PRD §4.13 — resultado de evaluar la calificación promedio contra los rangos
export interface ResultadoNivelPorCalificacion {
  nivel: NivelCONCER | null; // null = pierde elegibilidad (< 4.0)
  calificacion_promedio: number;
}

// PRD §4.13 — mecanismo de recuperación para conductores bajo el mínimo
export interface ModoPruebaSupervisada {
  conductor_id: string;
  // PRD: "Admin le asigna un número limitado de traslados monitoreados" —
  // el número exacto no está fijado en el PRD, lo define Admin por caso.
  traslados_asignados: number;
  traslados_completados: number;
  iniciado_en: string;
  finalizado_en?: string;
}
