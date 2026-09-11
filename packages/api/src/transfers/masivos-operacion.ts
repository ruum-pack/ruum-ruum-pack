import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";
import { listarTrasladosDeOperacion } from "../services/operaciones";
import type {
  FilaCargaTrasladosMasivosAdmin,
  FilaTrasladoMasivoNormalizada
} from "./masivos";

// FASE 8 — Operaciones masivas: preview, creación ligada a operación,
// progreso, resumen y centros. La importación v1 queda intacta; este módulo
// solo añade el flujo por operación (sin duplicar su lógica: delega en v1).

type Cliente = SupabaseClient<Database>;

const esquemaFilas = z.array(z.record(z.string(), z.string())).min(1).max(500);

const esquemaPreview = z.object({
  p_empresa_id: esquemaUuid,
  p_usuario_id: esquemaUuid,
  p_filas: esquemaFilas
});

const esquemaCrearOperacion = z.object({
  p_operacion_id: esquemaUuid,
  p_empresa_id: esquemaUuid,
  p_usuario_id: esquemaUuid,
  p_nombre_archivo: z.string().min(1).max(180),
  p_filas: esquemaFilas,
  p_hash_archivo: z.string().regex(/^[0-9a-f]{64}$/i, "Hash SHA-256 inválido"),
  p_tamano_bytes: z.number().int().positive().max(5 * 1024 * 1024),
  p_mime_type: z.string().min(1)
});

export interface FilaPreviewMasiva {
  numero: number;
  valida: boolean;
  errores: string[];
  advertencias: string[];
  duplicada_en_archivo: boolean;
  duplicada_en_historial: boolean;
  hash_fila: string;
  referencia_externa: string | null;
}

export interface PreviewCargaMasiva {
  total_filas: number;
  validas: number;
  con_error: number;
  duplicadas: number;
  filas: FilaPreviewMasiva[];
}

export interface ResultadoCargaOperacion {
  carga_id: string;
  total_filas: number;
  filas_creadas: number;
  filas_error: number;
  estado: string;
  reutilizada?: boolean;
  operacion_id: string;
}

export interface ProgresoCarga {
  carga_id: string;
  estado: string;
  total_filas: number;
  pendientes: number;
  creadas: number;
  con_error: number;
  canceladas: number;
  avance_pct: number;
  filas_con_error: Array<{ numero_fila: number; referencia_externa: string | null; errores: string[] }>;
}

export interface ResumenOperacionMasiva {
  operacion_id: string;
  cargas: number;
  filas_totales: number;
  filas_creadas: number;
  filas_error: number;
  traslados: number;
  traslados_por_estado: Record<string, number>;
  vehiculos: number;
  centros_origen: string[];
  centros_destino: string[];
  traslados_recientes: Array<{ id: string; estado: string; conductor_id: string | null }>;
}

export async function previsualizarCargaOperacion(
  cliente: Cliente,
  params: { empresaId: string; usuarioId: string; filas: Record<string, string>[] }
): Promise<PreviewCargaMasiva> {
  const { data, error } = await rpcValidado(cliente, "admin_previsualizar_carga_masiva", esquemaPreview, {
    p_empresa_id: params.empresaId,
    p_usuario_id: params.usuarioId,
    p_filas: params.filas
  });
  if (error) throw error;
  if (!data) throw new Error("Sin respuesta de previsualización.");
  return data as unknown as PreviewCargaMasiva;
}

export async function crearCargaMasivaOperacion(
  cliente: Cliente,
  params: {
    operacionId: string;
    empresaId: string;
    usuarioId: string;
    nombreArchivo: string;
    filas: Record<string, string>[];
    hashArchivo: string;
    tamanoBytes: number;
    mimeType: string;
  }
): Promise<ResultadoCargaOperacion> {
  const { data, error } = await rpcValidado(cliente, "admin_crea_carga_masiva_operacion", esquemaCrearOperacion, {
    p_operacion_id: params.operacionId,
    p_empresa_id: params.empresaId,
    p_usuario_id: params.usuarioId,
    p_nombre_archivo: params.nombreArchivo,
    p_filas: params.filas,
    p_hash_archivo: params.hashArchivo.toLowerCase(),
    p_tamano_bytes: params.tamanoBytes,
    p_mime_type: params.mimeType || "text/csv"
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo crear la carga masiva.");
  return data as unknown as ResultadoCargaOperacion;
}

export async function obtenerProgresoCarga(cliente: Cliente, cargaId: string): Promise<ProgresoCarga> {
  const { data: carga, error: errorCarga } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
      };
    };
  })
    .from("cargas_traslados_masivos")
    .select("id,estado,total_filas")
    .eq("id", cargaId)
    .maybeSingle();
  if (errorCarga) throw errorCarga;
  if (!carga) throw new Error("Carga no encontrada.");

  const { data: filas, error: errorFilas } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => Promise<{ data: FilaCargaTrasladosMasivosAdmin[] | null; error: unknown }>;
      };
    };
  })
    .from("filas_carga_traslados_masivos")
    .select("numero_fila,estado,referencia_externa,errores")
    .eq("carga_id", cargaId);
  if (errorFilas) throw errorFilas;

  const lista = filas ?? [];
  const porEstado = (estado: string) => lista.filter((f) => f.estado === estado).length;
  const pendientes = porEstado("pendiente");
  const creadas = porEstado("creada");
  const conError = porEstado("error");
  const canceladas = porEstado("cancelada");
  const total = Number(carga["total_filas"] ?? lista.length);
  return {
    carga_id: String(carga["id"]),
    estado: String(carga["estado"]),
    total_filas: total,
    pendientes,
    creadas,
    con_error: conError,
    canceladas,
    avance_pct: total === 0 ? 100 : Math.round(((creadas + conError + canceladas) / total) * 100),
    filas_con_error: lista
      .filter((f) => f.estado === "error")
      .map((f) => ({ numero_fila: f.numero_fila, referencia_externa: f.referencia_externa, errores: f.errores }))
  };
}

export async function listarCargasDeOperacion(
  cliente: Cliente,
  operacionId: string
): Promise<Array<{ id: string; nombre_archivo: string; estado: string; total_filas: number; filas_creadas: number; filas_error: number; creado_en: string }>> {
  const { data, error } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
        };
      };
    };
  })
    .from("cargas_traslados_masivos")
    .select("id,nombre_archivo,estado,total_filas,filas_creadas,filas_error,creado_en")
    .eq("operation_id", operacionId)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: String(c["id"]),
    nombre_archivo: String(c["nombre_archivo"]),
    estado: String(c["estado"]),
    total_filas: Number(c["total_filas"] ?? 0),
    filas_creadas: Number(c["filas_creadas"] ?? 0),
    filas_error: Number(c["filas_error"] ?? 0),
    creado_en: String(c["creado_en"] ?? "")
  }));
}

export async function obtenerResumenOperacionMasiva(
  cliente: Cliente,
  operacionId: string
): Promise<ResumenOperacionMasiva> {
  const [cargas, traslados] = await Promise.all([
    listarCargasDeOperacion(cliente, operacionId),
    listarTrasladosDeOperacion(cliente, operacionId)
  ]);

  let filasTotales = 0;
  let filasCreadas = 0;
  let filasError = 0;
  for (const c of cargas) {
    filasTotales += c.total_filas;
    filasCreadas += c.filas_creadas;
    filasError += c.filas_error;
  }

  const porEstado: Record<string, number> = {};
  const vehiculos = new Set<string>();
  for (const t of traslados) {
    porEstado[t.estado] = (porEstado[t.estado] ?? 0) + 1;
  }

  const centrosOrigen = new Set<string>();
  const centrosDestino = new Set<string>();
  if (cargas.length > 0) {
    const { data, error } = await (cliente as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (col: string, v: string[]) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
        };
      };
    })
      .from("filas_carga_traslados_masivos")
      .select("sucursal_origen_id,sucursal_destino_id,vehiculo_id")
      .in(
        "carga_id",
        cargas.map((c) => c.id)
      );
    if (error) throw error;
    for (const f of data ?? []) {
      if (f["sucursal_origen_id"]) centrosOrigen.add(String(f["sucursal_origen_id"]));
      if (f["sucursal_destino_id"]) centrosDestino.add(String(f["sucursal_destino_id"]));
      if (f["vehiculo_id"]) vehiculos.add(String(f["vehiculo_id"]));
    }
  }

  return {
    operacion_id: operacionId,
    cargas: cargas.length,
    filas_totales: filasTotales,
    filas_creadas: filasCreadas,
    filas_error: filasError,
    traslados: traslados.length,
    traslados_por_estado: porEstado,
    vehiculos: vehiculos.size,
    centros_origen: [...centrosOrigen],
    centros_destino: [...centrosDestino],
    traslados_recientes: traslados.slice(0, 100).map((t) => ({ id: t.id, estado: t.estado, conductor_id: t.conductor_id }))
  };
}

export type { FilaTrasladoMasivoNormalizada };
