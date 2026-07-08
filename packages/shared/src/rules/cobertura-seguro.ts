import type { EstadoTraslado } from "../types/traslado";
import type { EstadoReclamoSeguro } from "../types/seguro";

/**
 * PRD §4.9 — "El seguro de traslado de Ruum Ruum cubre daños ocurridos entre
 * los estados Vehículo recibido y Entrega confirmada... La cobertura no
 * aplica a daños documentados como preexistentes en la evidencia inicial."
 */
const ESTADOS_DENTRO_DE_CUSTODIA: EstadoTraslado[] = [
  "vehiculo_recibido",
  "traslado_en_curso",
  "incidencia_reportada",
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada"
];

export function estaDentroDeCobertura(estado: EstadoTraslado, danoPreexistente: boolean): boolean {
  if (danoPreexistente) return false;
  return ESTADOS_DENTRO_DE_CUSTODIA.includes(estado);
}

export interface TransicionReclamo {
  estado: EstadoReclamoSeguro;
  mensaje: string;
}

/**
 * PRD §4.9 — MVP del flujo de reclamo (8 pasos textuales del PRD,
 * modelados como transición de estado del reclamo):
 * identificado -> incidencia abierta -> usuario notificado ->
 * usuario confirma/disputa -> Admin evalúa -> reclamo abierto (si aplica) ->
 * en seguimiento -> resuelto.
 * Nota PRD §4.9: "las reglas de cobertura, deducible y tiempos de resolución
 * deben validarse con la aseguradora y área legal antes de construirse como
 * lógica de negocio definitiva." Por eso esta función solo modela el flujo
 * de ESTADOS, no montos de deducible ni cobertura.
 */
export function siguienteEstadoReclamo(
  estadoActual: EstadoReclamoSeguro | "sin_reclamo",
  evento: "admin_activa_reclamo" | "admin_actualiza_seguimiento" | "admin_resuelve"
): TransicionReclamo {
  if (estadoActual === "sin_reclamo" && evento === "admin_activa_reclamo") {
    return { estado: "abierto", mensaje: "Reclamo abierto ante la aseguradora." };
  }
  if (estadoActual === "abierto" && evento === "admin_actualiza_seguimiento") {
    return { estado: "en_revision", mensaje: "Reclamo en revisión (puede requerir documentación adicional)." };
  }
  if ((estadoActual === "abierto" || estadoActual === "en_revision") && evento === "admin_resuelve") {
    return { estado: "resuelto", mensaje: "Reclamo resuelto. Resolución registrada en el Pasaporte Digital." };
  }
  throw new Error(`Transición de reclamo inválida: ${estadoActual} -> ${evento}`);
}

// PRD §4.9 — "Si el usuario disputa el daño dentro del plazo de 48 horas...
// esa disputa se gestiona como tipo 'Daño no reconocido' bajo el mecanismo
// de la sección 4.14... el plazo de 48 horas aplica solo a la confirmación
// inicial y no sustituye el proceso formal de disputa."
export const HORAS_PLAZO_CONFIRMACION_DANO = 48;

export function dentroDePlazoConfirmacionDano(horasTranscurridasDesdeNotificacion: number): boolean {
  return horasTranscurridasDesdeNotificacion <= HORAS_PLAZO_CONFIRMACION_DANO;
}
