import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { evidenciaCompleta, type ResultadoEvidencia } from "@ruum/shared/rules";
import type { FotoEvidencia } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type EvidenciaRow = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
type AnguloEvidencia = Database["public"]["Enums"]["angulo_evidencia"];
type TipoEvidencia = Database["public"]["Enums"]["tipo_evidencia"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

function aFotoEvidencia(fila: EvidenciaRow): FotoEvidencia {
  return {
    id: fila.id,
    traslado_id: fila.traslado_id,
    tipo: fila.tipo,
    angulo: fila.angulo,
    ...(fila.url ? { url: fila.url } : {}),
    ...(fila.local_path ? { local_path: fila.local_path } : {}),
    timestamp: fila.capturada_en,
    ...(fila.lat !== null ? { lat: fila.lat } : {}),
    ...(fila.lng !== null ? { lng: fila.lng } : {}),
    sincronizada: fila.sincronizada
  };
}

/** PRD §4.4 — fotos ya registradas de un traslado, para mostrar avance del checklist. */
export async function obtenerEvidenciaDeTraslado(
  cliente: Cliente,
  trasladoId: string,
  tipo: TipoEvidencia
): Promise<FotoEvidencia[]> {
  const { data, error } = await cliente
    .from("evidencia_fotos")
    .select("*")
    .eq("traslado_id", trasladoId)
    .eq("tipo", tipo);

  if (error) throw error;
  return (data ?? []).map(aFotoEvidencia);
}

/**
 * Registra un ángulo como capturado. PRD §4.15 — el flujo real de campo es
 * capturar localmente y sincronizar después; sin Storage configurado en este
 * corte (ver app-conductor/README.md, sección "Pendiente"), esta función
 * inserta directamente la fila como sincronizada con una URL de marcador de
 * posición. El upload real de bytes a Supabase Storage queda para cuando se
 * conecte esa pieza — el contrato de datos (un row por ángulo) ya es el
 * definitivo.
 */
export async function registrarAnguloCapturado(
  cliente: Cliente,
  trasladoId: string,
  tipo: TipoEvidencia,
  angulo: AnguloEvidencia
) {
  const { error } = await cliente.from("evidencia_fotos").insert({
    traslado_id: trasladoId,
    tipo,
    angulo,
    url: `pendiente-storage://${trasladoId}/${tipo}/${angulo}`,
    sincronizada: true
  });

  if (error) throw error;
}

/** PRD §4.4 — completitud del checklist (5 ángulos obligatorios), en vivo. */
export async function evaluarCompletitud(
  cliente: Cliente,
  trasladoId: string,
  tipo: TipoEvidencia
): Promise<ResultadoEvidencia> {
  const fotos = await obtenerEvidenciaDeTraslado(cliente, trasladoId, tipo);
  return evidenciaCompleta(fotos, tipo);
}

/**
 * PRD §4.4 — "El viaje no puede iniciar sin evidencia inicial completa" /
 * "El servicio no puede cerrarse sin evidencia final completa." Solo avanza
 * el estado si evidenciaCompleta() ya dio true (se revalida aquí, no solo en
 * la pantalla, para que esta función nunca quede mal usada desde otro lugar).
 * evidencia_inicial_en_proceso -> evidencia_inicial_completada, o
 * evidencia_final_en_proceso -> evidencia_final_completada (ver TRANSICIONES).
 */
export async function confirmarEvidenciaCompleta(
  cliente: Cliente,
  trasladoId: string,
  estadoActual: EstadoTraslado,
  tipo: TipoEvidencia
) {
  const resultado = await evaluarCompletitud(cliente, trasladoId, tipo);
  if (!resultado.completa) {
    throw new Error(`Evidencia ${tipo} incompleta: faltan ${resultado.angulosFaltantes.join(", ")}`);
  }

  const siguienteEstado: EstadoTraslado =
    tipo === "inicial" ? "evidencia_inicial_completada" : "evidencia_final_completada";

  const { error } = await cliente
    .from("traslados")
    .update({ estado: siguienteEstado })
    .eq("id", trasladoId)
    .eq("estado", estadoActual);

  if (error) throw error;
  return siguienteEstado;
}
