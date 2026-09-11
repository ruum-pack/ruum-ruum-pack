import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";

type Cliente = SupabaseClient<Database>;
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface FilaTrasladoMasivoNormalizada {
  referencia_externa?: string;
  vehiculo_placas?: string;
  vehiculo_vin?: string;
  vehiculo_marca: string;
  vehiculo_modelo: string;
  vehiculo_anio: string;
  vehiculo_tipo: string;
  vehiculo_color?: string;
  vehiculo_alias?: string;
  vehiculo_transmision?: string;
  estado_general_declarado?: string;
  tiene_tarjeta_circulacion?: string;
  tiene_verificacion?: string;
  puede_circular_rodando?: string;
  categoria_tarifa: string;
  gama: string;
  condicion: string;
  contacto_entrega_nombre?: string;
  contacto_entrega_telefono?: string;
  contacto_recepcion_nombre?: string;
  contacto_recepcion_telefono?: string;
  origen_direccion?: string;
  origen_ciudad?: string;
  origen_lat?: string;
  origen_lng?: string;
  origen_referencias?: string;
  destino_direccion?: string;
  destino_ciudad?: string;
  destino_lat?: string;
  destino_lng?: string;
  destino_referencias?: string;
  instrucciones_especiales?: string;
  modalidad_programacion?: string;
  fecha_hora_programada?: string;
  tipo_ruta?: string;
  ventana_recoleccion?: string;
  ventana_entrega?: string;
  tipo_servicio?: string;
  motivo_servicio?: string;
  distancia_km?: string;
  tiempo_estimado_horas?: string;
  tipo_pago?: string;
}

export interface ResultadoCargaTrasladosMasivos {
  carga_id: string;
  total_filas: number;
  filas_creadas: number;
  filas_error: number;
  filas_procesadas: number;
  estado: EstadoCargaTrasladosMasivos;
  reutilizada?: boolean;
  procesadas_en_esta_corrida?: number;
}

export type EstadoCargaTrasladosMasivos =
  | "pendiente"
  | "procesando"
  | "procesada"
  | "procesada_con_errores"
  | "rechazada"
  | "cancelada";

export type EstadoFilaCargaTrasladosMasivos = "pendiente" | "creada" | "error" | "cancelada";

export interface CargaTrasladosMasivosAdmin {
  id: string;
  empresa_id: string;
  usuario_id: string;
  creado_por_admin_id: string | null;
  nombre_archivo: string;
  total_filas: number;
  filas_creadas: number;
  filas_error: number;
  filas_procesadas: number;
  estado: EstadoCargaTrasladosMasivos;
  hash_archivo: string | null;
  tamano_bytes: number;
  mime_type: string | null;
  iniciado_en: string | null;
  finalizado_en: string | null;
  cancelado_en: string | null;
  cancelado_por: string | null;
  reporte_errores_csv: string | null;
  mensaje_estado: string | null;
  creado_en: string;
}

export interface FilaCargaTrasladosMasivosAdmin {
  id: string;
  carga_id: string;
  numero_fila: number;
  estado: EstadoFilaCargaTrasladosMasivos;
  referencia_externa: string | null;
  datos: unknown;
  errores: string[];
  hash_fila: string | null;
  clave_idempotencia: string | null;
  vehiculo_id: string | null;
  traslado_id: string | null;
  procesado_en: string | null;
  creado_en: string;
}

export interface DatosTrasladosMasivosAdmin {
  cargas: CargaTrasladosMasivosAdmin[];
  filas: FilaCargaTrasladosMasivosAdmin[];
}

export async function listarCargasTrasladosMasivosAdmin(cliente: Cliente): Promise<DatosTrasladosMasivosAdmin> {
  await assertAdminPermission(cliente, "masivos:gestionar");
  type ConsultaLibre<T> = {
    select: (columnas: string) => {
      order: (columna: string, opciones?: { ascending?: boolean }) => Promise<{ data: T[] | null; error: Error | null }>;
    };
  };
  const clienteLibre = cliente as unknown as { from: <T>(tabla: string) => ConsultaLibre<T> };
  const [cargas, filas] = await Promise.all([
    clienteLibre.from<CargaTrasladosMasivosAdmin>("cargas_traslados_masivos").select("*").order("creado_en", { ascending: false }),
    clienteLibre.from<FilaCargaTrasladosMasivosAdmin>("filas_carga_traslados_masivos").select("*").order("creado_en", { ascending: false })
  ]);

  if (cargas.error) throw cargas.error;
  if (filas.error) throw filas.error;

  return {
    cargas: cargas.data ?? [],
    filas: filas.data ?? []
  };
}

export async function obtenerTrazabilidadMasivaTraslado(
  cliente: Cliente,
  trasladoId: string
): Promise<TrazabilidadMasivaTraslado | null> {
  await assertAdminPermission(cliente, "masivos:gestionar");
  type ConsultaDetalle<T> = {
    select: (columnas: string) => {
      eq: (columna: string, valor: string) => {
        maybeSingle: () => Promise<{ data: T | null; error: Error | null }>;
      };
    };
  };

  const clienteLibre = cliente as unknown as { from: <T>(tabla: string) => ConsultaDetalle<T> };
  const { data: fila, error: errorFila } = await clienteLibre
    .from<FilaCargaTrasladosMasivosAdmin>("filas_carga_traslados_masivos")
    .select("*")
    .eq("traslado_id", trasladoId)
    .maybeSingle();

  if (errorFila) throw errorFila;
  if (!fila) return null;

  const { data: carga, error: errorCarga } = await clienteLibre
    .from<CargaTrasladosMasivosAdmin>("cargas_traslados_masivos")
    .select("*")
    .eq("id", fila.carga_id)
    .maybeSingle();

  if (errorCarga) throw errorCarga;
  if (!carga) return null;

  return { carga, fila };
}

export async function crearTrasladosMasivosAdmin(
  cliente: Cliente,
  parametros: {
    empresaId: string;
    usuarioId: string;
    nombreArchivo: string;
    filas: FilaTrasladoMasivoNormalizada[];
    hashArchivo: string;
    tamanoBytes: number;
    mimeType: string;
  }
): Promise<ResultadoCargaTrasladosMasivos> {
  await assertAdminPermission(cliente, "masivos:gestionar");
  if (!parametros.empresaId) throw new Error("Selecciona la empresa corporativa.");
  if (!parametros.usuarioId) throw new Error("Selecciona el usuario solicitante.");
  if (!parametros.nombreArchivo.trim()) throw new Error("El archivo debe tener nombre.");
  if (!/^[0-9a-f]{64}$/i.test(parametros.hashArchivo)) throw new Error("No se pudo calcular un hash válido del archivo.");
  if (parametros.tamanoBytes <= 0) throw new Error("El archivo está vacío.");
  if (parametros.tamanoBytes > 5 * 1024 * 1024) throw new Error("El archivo debe pesar máximo 5 MB.");
  if (parametros.filas.length === 0) throw new Error("El archivo no contiene filas válidas para enviar.");

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_crea_traslados_masivos",
    args: {
      p_empresa_id: string;
      p_usuario_id: string;
      p_nombre_archivo: string;
      p_filas: FilaTrasladoMasivoNormalizada[];
      p_hash_archivo: string;
      p_tamano_bytes: number;
      p_mime_type: string;
    }
  ) => Promise<{ data: ResultadoCargaTrasladosMasivos | null; error: Error | null }>;

  const { data, error } = await rpc("admin_crea_traslados_masivos", {
    p_empresa_id: parametros.empresaId,
    p_usuario_id: parametros.usuarioId,
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

export async function procesarCargaTrasladosMasivosAdmin(
  cliente: Cliente,
  cargaId: string,
  limite = 50
): Promise<ResultadoCargaTrasladosMasivos> {
  await assertAdminPermission(cliente, "masivos:gestionar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_procesa_carga_traslados_masivos",
    args: { p_carga_id: string; p_limite: number }
  ) => Promise<{ data: ResultadoCargaTrasladosMasivos | null; error: Error | null }>;

  const { data, error } = await rpc("admin_procesa_carga_traslados_masivos", {
    p_carga_id: cargaId,
    p_limite: limite
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo procesar la carga masiva.");
  return data;
}

export async function cancelarCargaTrasladosMasivosAdmin(cliente: Cliente, cargaId: string, motivo: string) {
  await assertAdminPermission(cliente, "masivos:gestionar");
  if (!motivo.trim()) throw new Error("Captura el motivo de cancelación.");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_cancela_carga_traslados_masivos",
    args: { p_carga_id: string; p_motivo: string }
  ) => Promise<{ data: { carga_id: string; estado: EstadoCargaTrasladosMasivos } | null; error: Error | null }>;

  const { data, error } = await rpc("admin_cancela_carga_traslados_masivos", {
    p_carga_id: cargaId,
    p_motivo: motivo.trim()
  });
  if (error) throw error;
  return data;
}


export interface TrazabilidadMasivaTraslado {
  carga: CargaTrasladosMasivosAdmin;
  fila: FilaCargaTrasladosMasivosAdmin;
}
