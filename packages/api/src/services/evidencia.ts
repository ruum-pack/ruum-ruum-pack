import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { debeAbrirIncidenciaDanoNoReportado, evidenciaCompleta, type ResultadoEvidencia } from "@ruum/shared/rules";
import type { FotoEvidencia } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";
import { crearIncidenciaSistemaDanoNoReportado } from "./incidencias";

type Cliente = SupabaseClient<Database>;
type EvidenciaRow = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
type AnguloEvidencia = Database["public"]["Enums"]["angulo_evidencia"];
type TipoEvidencia = Database["public"]["Enums"]["tipo_evidencia"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export const BUCKET_EVIDENCIA = "evidencia";
export type FotoEvidenciaConUrlVisual<T extends { url?: string | null } = FotoEvidencia> = T & {
  url_visual: string | null;
};

async function obtenerConductorIdActual(cliente: Cliente): Promise<string> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) {
    throw new Error("No hay sesión de conductor para registrar auditoría.");
  }

  const { data, error } = await cliente.from("conductores").select("id").eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No se encontró el conductor para registrar auditoría.");
  return data.id;
}

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

export function rutaEvidenciaDesdeUrl(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const parsed = new URL(valor);
    const marcadores = [
      `/storage/v1/object/public/${BUCKET_EVIDENCIA}/`,
      `/storage/v1/object/sign/${BUCKET_EVIDENCIA}/`
    ];
    const marcador = marcadores.find((candidate) => parsed.pathname.includes(candidate));
    if (!marcador) return null;
    const pathConToken = parsed.pathname.slice(parsed.pathname.indexOf(marcador) + marcador.length);
    return decodeURIComponent(pathConToken);
  } catch {
    if (valor.includes("://") || valor.startsWith("/")) return null;
    return valor;
  }
}

export async function resolverUrlEvidencia(
  cliente: Cliente,
  storagePathOrUrl: string | null | undefined,
  expiracionSegundos = 60 * 30
): Promise<string | null> {
  const ruta = rutaEvidenciaDesdeUrl(storagePathOrUrl);
  if (!ruta) return null;

  const { data, error } = await cliente.storage.from(BUCKET_EVIDENCIA).createSignedUrl(ruta, expiracionSegundos);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function firmarUrlsEvidencia<T extends { url?: string | null }>(
  cliente: Cliente,
  fotos: T[],
  expiracionSegundos = 60 * 30
): Promise<FotoEvidenciaConUrlVisual<T>[]> {
  return Promise.all(
    fotos.map(async (foto) => ({
      ...foto,
      url_visual: await resolverUrlEvidencia(cliente, foto.url, expiracionSegundos)
    }))
  );
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

async function evaluarDanoNoReportado(cliente: Cliente, trasladoId: string) {
  const [inicial, final, incidencias] = await Promise.all([
    obtenerEvidenciaDeTraslado(cliente, trasladoId, "inicial"),
    obtenerEvidenciaDeTraslado(cliente, trasladoId, "final"),
    cliente.from("incidencias").select("id, tipo").eq("traslado_id", trasladoId).eq("resuelta", false)
  ]);

  if (incidencias.error) throw incidencias.error;

  const danoDetectadoEnFinal = final.some((foto) => foto.angulo === "dano_previo" && foto.sincronizada);
  const danoPresenteEnInicial = inicial.some((foto) => foto.angulo === "dano_previo" && foto.sincronizada);
  const incidenciaYaReportadaDuranteTraslado = (incidencias.data ?? []).some((incidencia) => incidencia.tipo !== "dano_no_reportado");

  if (
    debeAbrirIncidenciaDanoNoReportado(
      danoDetectadoEnFinal,
      danoPresenteEnInicial,
      incidenciaYaReportadaDuranteTraslado
    )
  ) {
    await crearIncidenciaSistemaDanoNoReportado(
      cliente,
      trasladoId,
      "El registro final del vehículo incluye daño visible que no aparece en el registro inicial y no fue reportado durante el traslado."
    );
  }
}

async function validarMetodoPagoParaEvidenciaInicial(cliente: Cliente, trasladoId: string) {
  const { data, error } = await cliente.rpc("traslado_tiene_metodo_pago_registrado", {
    p_traslado_id: trasladoId
  });

  if (error) throw error;
  if (!data) {
    throw new Error("No se puede completar el registro inicial del vehículo: falta pago anticipado completado o método de pago al cierre.");
  }
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
  if (tipo === "inicial") {
    await validarMetodoPagoParaEvidenciaInicial(cliente, trasladoId);
  }

  const resultado = await evaluarCompletitud(cliente, trasladoId, tipo);
  if (!resultado.completa) {
    throw new Error(`Registro ${tipo} del vehículo incompleto: faltan ${resultado.angulosFaltantes.join(", ")}`);
  }

  const estadoEsperado: EstadoTraslado = tipo === "inicial" ? "evidencia_inicial_en_proceso" : "evidencia_final_en_proceso";
  if (estadoActual !== estadoEsperado) {
    throw new Error(`No se puede confirmar el registro ${tipo} del vehículo desde ${estadoActual}`);
  }

  const siguienteEstado: EstadoTraslado =
    tipo === "inicial" ? "evidencia_inicial_completada" : "evidencia_final_completada";

  const evento = tipo === "inicial" ? "evidencia_inicial_completada" : "evidencia_final_completada";
  const { data, error } = await cliente.rpc("conductor_avanza_traslado", {
    p_traslado_id: trasladoId,
    p_evento: evento
  });

  if (error) throw error;

  const conductorId = await obtenerConductorIdActual(cliente);
  await registrarEvento(
    cliente,
    tipo === "inicial" ? "captura_evidencia_inicial" : "captura_evidencia_final",
    "conductor",
    conductorId,
    {
      traslado_id: trasladoId,
      tipo,
      estado_anterior: estadoActual,
      estado_nuevo: data ?? siguienteEstado
    }
  );

  if (tipo === "final") {
    await evaluarDanoNoReportado(cliente, trasladoId);
  }

  return data ?? siguienteEstado;
}
