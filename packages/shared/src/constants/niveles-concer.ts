import type { NivelCONCER, TipoCertificacion } from "../types/conductor";
import type { TipoVehiculo } from "../types/vehiculo";

export const ORDEN_NIVEL: Record<NivelCONCER, number> = {
  basico: 0,
  ejecutivo: 1,
  luxury: 2,
  coleccion: 3
};

export const NIVELES_CONCER: NivelCONCER[] = ["basico", "ejecutivo", "luxury", "coleccion"];

export interface RequisitosNivel {
  traslados_completados_min: number;
  calificacion_min: number;
  certificaciones_requeridas: TipoCertificacion[];
  // PRD §4.3: "sin incidencias graves en últimos N meses" (Ejecutivo: 6m, Luxury: 12m)
  ventana_meses_sin_incidencias_graves: number;
  vehiculos_permitidos: TipoVehiculo[];
  rutas_permitidas: TipoRuta[];
}

// PRD §4.3 — "Dentro de la misma ciudad", "+ interurbanas < 100 km", "Todas las rutas"
export type TipoRuta = "intraurbana" | "interurbana_menos_100km" | "interurbana_mas_100km";

// PRD §4.3 — Matriz de elegibilidad de conductores.
// Nota: "Admin puede ajustar requisitos mínimos según política operativa" —
// estos valores son la política inicial documentada, no constantes inmutables.
export const REQUISITOS_NIVEL_CONCER: Record<NivelCONCER, RequisitosNivel> = {
  basico: {
    traslados_completados_min: 0,
    calificacion_min: 4.0,
    certificaciones_requeridas: [],
    ventana_meses_sin_incidencias_graves: 0,
    vehiculos_permitidos: ["sedan", "suv"],
    rutas_permitidas: ["intraurbana"]
  },
  ejecutivo: {
    traslados_completados_min: 10,
    calificacion_min: 4.5,
    certificaciones_requeridas: [],
    ventana_meses_sin_incidencias_graves: 6,
    vehiculos_permitidos: ["sedan", "suv", "pick_up", "van"],
    rutas_permitidas: ["intraurbana", "interurbana_menos_100km"]
  },
  luxury: {
    traslados_completados_min: 30,
    calificacion_min: 4.8,
    certificaciones_requeridas: ["vehiculos_luxury"],
    ventana_meses_sin_incidencias_graves: 12,
    vehiculos_permitidos: ["sedan", "suv", "pick_up", "van", "luxury"],
    rutas_permitidas: ["intraurbana", "interurbana_menos_100km", "interurbana_mas_100km"]
  },
  coleccion: {
    traslados_completados_min: 50,
    calificacion_min: 4.9,
    certificaciones_requeridas: ["vehiculos_coleccion"],
    // PRD no especifica ventana adicional para Colección más allá de heredar Luxury (12m)
    ventana_meses_sin_incidencias_graves: 12,
    vehiculos_permitidos: ["sedan", "suv", "pick_up", "van", "luxury", "coleccion"],
    rutas_permitidas: ["intraurbana", "interurbana_menos_100km", "interurbana_mas_100km"]
  }
};

// PRD §4.3 — niveles CONCER con acento correcto. El enum de Postgres y los
// valores TS (NivelCONCER) son ASCII puro ("basico") porque los identificadores
// de enum no llevan acento; esta es la única traducción a texto visible que
// debe usarse en UI en vez de un CSS capitalize() sobre el valor crudo.
export const ETIQUETA_NIVEL_CONCER: Record<NivelCONCER, string> = {
  basico: "Básico",
  ejecutivo: "Ejecutivo",
  luxury: "Luxury",
  coleccion: "Colección"
};
