import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import type {
  EstadoCargaTrasladosMasivos,
  FilaTrasladoMasivoNormalizada,
  ResultadoCargaTrasladosMasivos
} from "./admin";

type Cliente = SupabaseClient<Database>;

export interface CargaTrasladosMasivosUsuario {
  id: string;
  nombre_archivo: string;
  total_filas: number;
  filas_creadas: number;
  filas_error: number;
  filas_procesadas: number;
  estado: EstadoCargaTrasladosMasivos;
  creado_en: string;
  reporte_errores_csv: string | null;
  mensaje_estado: string | null;
}

export async function crearTrasladosMasivosUsuario(
  cliente: Cliente,
  parametros: {
    nombreArchivo: string;
    filas: FilaTrasladoMasivoNormalizada[];
    hashArchivo: string;
    tamanoBytes: number;
    mimeType?: string;
  }
): Promise<ResultadoCargaTrasladosMasivos> {
  if (!parametros.nombreArchivo.trim()) throw new Error("El archivo debe tener nombre.");
  if (!/^[0-9a-f]{64}$/i.test(parametros.hashArchivo)) {
    throw new Error("No se pudo calcular un hash válido del archivo.");
  }
  if (parametros.tamanoBytes <= 0) throw new Error("El archivo está vacío.");
  if (parametros.tamanoBytes > 5 * 1024 * 1024) throw new Error("El archivo debe pesar máximo 5 MB.");
  if (parametros.filas.length === 0) throw new Error("El archivo no contiene filas para enviar.");
  if (parametros.filas.length > 100) throw new Error("El límite por carga es de 100 traslados.");

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "usuario_crea_traslados_masivos",
    args: {
      p_nombre_archivo: string;
      p_filas: FilaTrasladoMasivoNormalizada[];
      p_hash_archivo: string;
      p_tamano_bytes: number;
      p_mime_type: string;
    }
  ) => Promise<{ data: ResultadoCargaTrasladosMasivos | null; error: Error | null }>;

  const { data, error } = await rpc("usuario_crea_traslados_masivos", {
    p_nombre_archivo: parametros.nombreArchivo,
    p_filas: parametros.filas,
    p_hash_archivo: parametros.hashArchivo.toLowerCase(),
    p_tamano_bytes: parametros.tamanoBytes,
    p_mime_type: parametros.mimeType || "text/csv"
  });

  if (error) throw error;
  if (!data) throw new Error("No se pudo confirmar la carga masiva.");
  return data;
}

export async function procesarCargaTrasladosMasivosUsuario(
  cliente: Cliente,
  cargaId: string,
  limite = 50
): Promise<ResultadoCargaTrasladosMasivos> {
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "usuario_procesa_carga_traslados_masivos",
    args: { p_carga_id: string; p_limite: number }
  ) => Promise<{ data: ResultadoCargaTrasladosMasivos | null; error: Error | null }>;

  const { data, error } = await rpc("usuario_procesa_carga_traslados_masivos", {
    p_carga_id: cargaId,
    p_limite: limite
  });

  if (error) throw error;
  if (!data) throw new Error("No se pudo procesar la carga de traslados.");
  return data;
}

export async function obtenerEstadoCargaMasivaUsuario(
  cliente: Cliente,
  cargaId: string
): Promise<CargaTrasladosMasivosUsuario | null> {
  const { data, error } = await cliente
    .from("cargas_traslados_masivos")
    .select("id, nombre_archivo, total_filas, filas_creadas, filas_error, filas_procesadas, estado, creado_en, reporte_errores_csv, mensaje_estado")
    .eq("id", cargaId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as unknown as CargaTrasladosMasivosUsuario;
}

export async function listarCargasMasivasUsuario(
  cliente: Cliente
): Promise<CargaTrasladosMasivosUsuario[]> {
  const { data, error } = await cliente
    .from("cargas_traslados_masivos")
    .select("id, nombre_archivo, total_filas, filas_creadas, filas_error, filas_procesadas, estado, creado_en, reporte_errores_csv, mensaje_estado")
    .order("creado_en", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as unknown as CargaTrasladosMasivosUsuario[];
}
