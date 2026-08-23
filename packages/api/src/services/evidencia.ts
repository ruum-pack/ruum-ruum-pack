import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { debeAbrirIncidenciaDanoNoReportado, evidenciaCompleta, type ResultadoEvidencia } from "@ruum/shared/rules";
import type { FotoEvidencia } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";
import { crearIncidenciaSistemaDanoNoReportado } from "./incidencias";

type Cliente = SupabaseClient<Database>;
type EvidenciaRow = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
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

/**
 * Extrae la ruta privada de storage para un comprobante de gasto, soportando
 * la columna dedicada 'comprobante_ruta', tags estructurados '[COMPROBANTE_RUTA: ...]'
 * y migrando limpiamente registros legados con '[COMPROBANTE: ...]'.
 */
export function extraerRutaComprobante(
  descripcion: string | null | undefined,
  comprobanteRutaCol?: string | null | undefined
): { ruta: string | null; texto: string | null } {
  if (comprobanteRutaCol) {
    const rutaLimpia = rutaEvidenciaDesdeUrl(comprobanteRutaCol) ?? comprobanteRutaCol;
    let texto = descripcion || null;
    if (texto) {
      texto = texto
        .replace(/\[COMPROBANTE_RUTA:\s*[^\]]+\]/g, "")
        .replace(/\[COMPROBANTE:\s*[^\]]+\]/g, "")
        .trim() || null;
    }
    return { ruta: rutaLimpia, texto };
  }

  if (!descripcion) return { ruta: null, texto: null };

  const matchRuta = descripcion.match(/\[COMPROBANTE_RUTA:\s*([^\]]+)\]/);
  if (matchRuta && matchRuta[1]) {
    const ruta = matchRuta[1].trim();
    const texto = descripcion.replace(matchRuta[0], "").trim() || null;
    return { ruta: rutaEvidenciaDesdeUrl(ruta) ?? ruta, texto };
  }

  const matchLegado = descripcion.match(/\[COMPROBANTE:\s*([^\]]+)\]/);
  if (matchLegado && matchLegado[1]) {
    const raw = matchLegado[1].trim();
    const ruta = rutaEvidenciaDesdeUrl(raw) ?? (raw.startsWith("http") ? null : raw);
    const texto = descripcion.replace(matchLegado[0], "").trim() || null;
    return { ruta, texto };
  }

  return { ruta: null, texto: descripcion };
}

/**
 * Extrae la ruta privada de evidencia y el nombre del archivo en la descripción
 * de una incidencia, sanitizando y eliminando cualquier URL firmada histórica.
 */
export function extraerRutaIncidencia(descripcion: string | null | undefined): {
  ruta: string | null;
  nombre: string | null;
  textoLimpio: string;
} {
  if (!descripcion) return { ruta: null, nombre: null, textoLimpio: "" };

  let ruta: string | null = null;
  let nombre: string | null = null;

  const matchRuta = descripcion.match(/Ruta:\s*([^\n\r]+)/i);
  if (matchRuta && matchRuta[1]) {
    ruta = rutaEvidenciaDesdeUrl(matchRuta[1].trim()) ?? matchRuta[1].trim();
  }

  const matchNombre = descripcion.match(/Evidencia adjunta:\s*([^\n\r]+)/i);
  if (matchNombre && matchNombre[1]) {
    nombre = matchNombre[1].trim();
  }

  if (!ruta) {
    const matchUrl = descripcion.match(/URL temporal:\s*([^\n\r\s]+)/i);
    if (matchUrl && matchUrl[1]) {
      ruta = rutaEvidenciaDesdeUrl(matchUrl[1].trim());
    }
  }

  const textoLimpio = descripcion
    .replace(/\n*URL temporal:\s*https?:\/\/[^\n\r]+/gi, "")
    .replace(/https?:\/\/[^\s]+\/storage\/v1\/object\/sign\/[^\s]+/gi, "")
    .trim();

  return { ruta, nombre, textoLimpio };
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
