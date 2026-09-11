import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { registrarEvento } from "../services/auditoria";

type Cliente = SupabaseClient<Database>;
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];

export interface DatosVehiculosAdmin {
  vehiculos: VehiculoRow[];
  usuarios: UsuarioRow[];
}

export interface PaginacionAdmin {
  pagina: number;
  tamano: number;
  total: number;
  total_paginas: number;
}

export interface DatosVehiculosAdminPaginados extends DatosVehiculosAdmin {
  paginacion: PaginacionAdmin;
}

export async function listarVehiculosAdmin(cliente: Cliente): Promise<DatosVehiculosAdmin> {
  await assertAdminPermission(cliente, "vehiculos:leer");
  const [vehiculos, usuarios] = await Promise.all([
    cliente.from("vehiculos").select("*").order("creado_en", { ascending: false }),
    cliente.from("usuarios").select("*").order("creado_en", { ascending: false })
  ]);

  for (const resultado of [vehiculos, usuarios]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    vehiculos: vehiculos.data ?? [],
    usuarios: usuarios.data ?? []
  };
}

export async function listarVehiculosAdminPaginados(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  busqueda?: string
): Promise<DatosVehiculosAdminPaginados> {
  await assertAdminPermission(cliente, "vehiculos:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_listar_vehiculos_paginados",
    args: { p_pagina: number; p_tamano: number; p_busqueda: string | null }
  ) => Promise<{ data: DatosVehiculosAdminPaginados | null; error: unknown }>;
  const { data, error } = await rpc("admin_listar_vehiculos_paginados", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_busqueda: busqueda?.trim() || null
  });
  if (error) throw error;
  return data ?? {
    vehiculos: [],
    usuarios: [],
    paginacion: { pagina: 1, tamano, total: 0, total_paginas: 0 }
  };
}

export async function obtenerVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"] | null> {
  await assertAdminPermission(cliente, "vehiculos:leer");
  const { data, error } = await cliente.from("vehiculos").select("*").eq("id", vehiculoId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Valida unicidad de VIN y placas.
 */
export async function validarVinYPlacasUnicos(
  cliente: Cliente,
  vin: string | null | undefined,
  placas: string | null | undefined,
  excluirId?: string
): Promise<{ vinUnico: boolean; placasUnicas: boolean; conflictoVin?: string; conflictoPlacas?: string }> {
  const [conflictoVin, conflictoPlacas] = await Promise.all([
    vin ? cliente.from("vehiculos").select("id, placas").eq("vin", vin.toUpperCase()).maybeSingle() : Promise.resolve({ data: null, error: null }),
    placas ? cliente.from("vehiculos").select("id, vin").eq("placas", placas.toUpperCase()).maybeSingle() : Promise.resolve({ data: null, error: null })
  ]);
  const vinExiste = conflictoVin.data && (!excluirId || conflictoVin.data.id !== excluirId);
  const placasExisten = conflictoPlacas.data && (!excluirId || conflictoPlacas.data.id !== excluirId);
  return {
    vinUnico: !vinExiste,
    placasUnicas: !placasExisten,
    conflictoVin: vinExiste ? conflictoVin.data!.id : undefined,
    conflictoPlacas: placasExisten ? conflictoPlacas.data!.id : undefined
  };
}

/**
 * Valida formato de VIN (17 caracteres alfanuméricos estándar ISO 3779).
 */
export function validarFormatoVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin.toUpperCase());
}

/**
 * Valida formato de placas (formato genérico: 3-7 alfanuméricos).
 */
export function validarFormatoPlacas(placas: string): boolean {
  return /^[A-Z0-9]{3,7}$/.test(placas.toUpperCase());
}

/**
 * Alta de vehículo real (sin datos demo).
 */
export type VehiculoCrearAdmin = Database["public"]["Tables"]["vehiculos"]["Insert"] & {
  usuario_id: string;
};

export async function crearVehiculoAdmin(
  cliente: Cliente,
  datos: VehiculoCrearAdmin
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"]> {
  await assertAdminPermission(cliente, "vehiculos:gestionar");

  if (datos.vin) {
    const valido = validarFormatoVin(datos.vin);
    if (!valido) throw new Error("VIN inválido: debe tener 17 caracteres alfanuméricos (ISO 3779).");
    const unicos = await validarVinYPlacasUnicos(cliente, datos.vin, datos.placas);
    if (!unicos.vinUnico) throw new Error("El VIN ya está registrado en otro vehículo.");
  }
  if (datos.placas) {
    const valido = validarFormatoPlacas(datos.placas);
    if (!valido) throw new Error("Placas inválidas: 3-7 caracteres alfanuméricos.");
    const unicos = await validarVinYPlacasUnicos(cliente, datos.vin, datos.placas);
    if (!unicos.placasUnicas) throw new Error("Las placas ya están registradas en otro vehículo.");
  }

  const { data, error } = await cliente.from("vehiculos").insert(datos).select("*").single();
  if (error) throw error;
  await registrarEvento(cliente, "creacion_vehiculo" as never, "admin", data.id, { accion: "alta_manual" });
  return data;
}

/**
 * Edición de vehículo con validaciones.
 * Relajado a Update completo para compatibilidad con Database generado (conductor_id no existe en tipo base).
 */
export type VehiculoActualizarAdmin = Database["public"]["Tables"]["vehiculos"]["Update"];

function normalizarTextoVehiculo(valor: unknown): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

function normalizarIdentificadorVehiculo(valor: unknown): string | null | undefined {
  const texto = normalizarTextoVehiculo(valor);
  return typeof texto === "string" ? texto.toUpperCase().replace(/[\s-]/g, "") : texto;
}

export function validarDominioVehiculoAdmin(datos: VehiculoActualizarAdmin): VehiculoActualizarAdmin {
  const normalizados = { ...datos };

  if ("vin" in normalizados) normalizados.vin = normalizarIdentificadorVehiculo(normalizados.vin) as VehiculoActualizarAdmin["vin"];
  if ("placas" in normalizados) normalizados.placas = normalizarIdentificadorVehiculo(normalizados.placas) as VehiculoActualizarAdmin["placas"];
  for (const campo of ["marca", "modelo", "color", "alias", "estado_general_declarado"] as const) {
    if (campo in normalizados) normalizados[campo] = normalizarTextoVehiculo(normalizados[campo]) as never;
  }

  if (normalizados.anio !== undefined && normalizados.anio !== null) {
    const anio = Number(normalizados.anio);
    const maximo = new Date().getFullYear() + 1;
    if (!Number.isInteger(anio) || anio < 1980 || anio > maximo) {
      throw new Error(`Año inválido: debe estar entre 1980 y ${maximo}.`);
    }
    normalizados.anio = anio as VehiculoActualizarAdmin["anio"];
  }

  if (normalizados.marca === null) throw new Error("Marca obligatoria.");
  if (normalizados.modelo === null) throw new Error("Modelo obligatorio.");

  const tarifa = [normalizados.categoria_tarifa, normalizados.gama, normalizados.condicion];
  const tieneClasificacionParcial = tarifa.some((valor) => valor !== undefined && valor !== null);
  const tieneClasificacionCompleta = tarifa.every((valor) => valor !== undefined && valor !== null);
  if (tieneClasificacionParcial && !tieneClasificacionCompleta) {
    throw new Error("Clasificación tarifaria incompleta: categoría, gama y condición deben capturarse juntas.");
  }

  if (normalizados.puede_circular_rodando === true && Boolean(normalizados.permiso_especial_vigente) !== true) {
    const camposRequeridos = [
      ["tiene_placas", "placas"],
      ["tiene_tarjeta_circulacion", "tarjeta de circulación"],
      ["tiene_verificacion", "verificación"]
    ] as const;
    const faltantes = camposRequeridos
      .filter(([campo]) => normalizados[campo] === false)
      .map(([, etiqueta]) => etiqueta);
    if (faltantes.length > 0) {
      throw new Error(`No puede circular rodando sin ${faltantes.join(", ")} o permiso especial vigente.`);
    }
  }

  if (normalizados.tiene_placas === true && !normalizados.placas && "placas" in normalizados) {
    throw new Error("Placas obligatorias cuando el vehículo está marcado con placas.");
  }

  return normalizados;
}

export async function actualizarVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  datos: VehiculoActualizarAdmin,
  versionEsperada?: number
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"]> {
  await assertAdminPermission(cliente, "vehiculos:gestionar");
  const datosValidados = validarDominioVehiculoAdmin(datos);

  if (datosValidados.vin) {
    const valido = validarFormatoVin(datosValidados.vin);
    if (!valido) throw new Error("VIN inválido: debe tener 17 caracteres alfanuméricos (ISO 3779).");
    const unicos = await validarVinYPlacasUnicos(cliente, datosValidados.vin, datosValidados.placas, vehiculoId);
    if (!unicos.vinUnico) throw new Error("El VIN ya está registrado en otro vehículo.");
  }
  if (datosValidados.placas) {
    const valido = validarFormatoPlacas(datosValidados.placas);
    if (!valido) throw new Error("Placas inválidas: 3-7 caracteres alfanuméricos.");
    const unicos = await validarVinYPlacasUnicos(cliente, datosValidados.vin, datosValidados.placas, vehiculoId);
    if (!unicos.placasUnicas) throw new Error("Las placas ya están registradas en otro vehículo.");
  }

  if (versionEsperada !== undefined) {
    const { data: rpcData, error: rpcError } = await cliente.rpc("admin_actualizar_vehiculo", {
      p_vehiculo_id: vehiculoId,
      p_datos: datosValidados as any,
      p_version_esperada: versionEsperada
    });
    if (rpcError) {
      if (String(rpcError).includes("CONCURRENCY_CONFLICT")) {
        throw new Error("Conflicto de concurrencia: el vehículo fue modificado por otro operador. Recarga los datos e intenta de nuevo.");
      }
      throw rpcError;
    }
    const { data: refreshed } = await cliente.from("vehiculos").select("*").eq("id", vehiculoId).single();
    if (refreshed) return refreshed;
    throw new Error("No se pudo recuperar el vehículo actualizado.");
  }

  const { data: actual, error: errorActual } = await cliente.from("vehiculos").select("version").eq("id", vehiculoId).single();
  if (errorActual) throw errorActual;
  return actualizarVehiculoAdmin(cliente, vehiculoId, datosValidados, (actual as { version?: number }).version ?? 0);
}

/**
 * Documentos del vehículo (tarjeta circulación, seguro, verificación).
 */
export async function obtenerDocumentosVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string
): Promise<Record<string, unknown>[]> {
  await assertAdminPermission(cliente, "vehiculos:leer");
  const { data, error } = await (cliente as unknown as { from: (t: string) => any }).from("documentos_vehiculo")
    .select("*")
    .eq("vehiculo_id", vehiculoId)
    .order("creado_en", { ascending: false }) as unknown as { data: Record<string, unknown>[] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}

export async function subirDocumentoVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  tipo: "tarjeta_circulacion" | "seguro" | "verificacion" | "permiso_especial",
  archivo: File
): Promise<Record<string, unknown>> {
  await assertAdminPermission(cliente, "vehiculos:gestionar");
  // Validaciones de archivo
  if (archivo.size > 10 * 1024 * 1024) throw new Error("El archivo debe pesar máximo 10 MB.");
  const ext = archivo.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "jpg", "jpeg", "png", "webp"].includes(ext ?? "")) throw new Error("Formato inválido: PDF, JPG, PNG o WEBP.");

  const path = `${vehiculoId}/${tipo}.${ext}`;
  const { error: errUp } = await cliente.storage.from("documentos-vehiculo").upload(path, archivo, { upsert: true, contentType: archivo.type });
  if (errUp) throw errUp;

  const { data: urlData } = cliente.storage.from("documentos-vehiculo").getPublicUrl(path);
  const url = `${urlData.publicUrl}?v=${Date.now()}`;

  const { data, error } = await (cliente as unknown as { from: (t: string) => any }).from("documentos_vehiculo").insert({
    vehiculo_id: vehiculoId,
    tipo,
    url,
    nombre_archivo: archivo.name,
    tamano_bytes: archivo.size,
    mime_type: archivo.type
  }).select("*").single() as unknown as { data: Record<string, unknown> | null; error: unknown };
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function eliminarDocumentoVehiculoAdmin(
  cliente: Cliente,
  documentoId: string
): Promise<void> {
  await assertAdminPermission(cliente, "vehiculos:gestionar");
  const { data: doc, error: errDoc } = await (cliente as unknown as { from: (t: string) => any }).from("documentos_vehiculo").select("url, vehiculo_id").eq("id", documentoId).single() as unknown as { data: { url: string; vehiculo_id: string } | null; error: unknown };
  if (errDoc) throw errDoc;
  if (doc?.url) {
    const url = new URL(doc.url);
    const path = url.pathname.split("/documentos-vehiculo/")[1];
    if (path) await cliente.storage.from("documentos-vehiculo").remove([path]);
  }
  const { error } = await (cliente as unknown as { from: (t: string) => any }).from("documentos_vehiculo").delete().eq("id", documentoId) as unknown as { error: unknown };
  if (error) throw error;
}

/**
 * Asociar/desasociar conductor y empresa.
 */
export async function asociarConductorVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  conductorId: string | null
): Promise<void> {
  await actualizarVehiculoAdmin(cliente, vehiculoId, { conductor_id: conductorId } as unknown as VehiculoActualizarAdmin);
}

export async function asociarEmpresaVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  empresaId: string | null
): Promise<void> {
  await actualizarVehiculoAdmin(cliente, vehiculoId, { empresa_id: empresaId });
}

/**
 * Suspender vehículo no elegible (documentación vencida, sin seguro, etc.).
 */
export async function suspenderVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  motivo: string
): Promise<void> {
  await actualizarVehiculoAdmin(cliente, vehiculoId, { puede_circular_rodando: false, estado_general_declarado: motivo });
}

/**
 * Reactivar vehículo.
 */
export async function reactivarVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  motivo: string
): Promise<void> {
  await actualizarVehiculoAdmin(cliente, vehiculoId, { puede_circular_rodando: true, estado_general_declarado: motivo });
}

/**
 * Historial de asignaciones y viajes.
 */
export interface HistorialAsignacionVehiculo {
  id: string;
  vehiculo_id: string;
  conductor_id: string | null;
  empresa_id: string | null;
  estado_anterior: string | null;
  estado_nuevo: string;
  cambiado_por: string;
  cambiado_en: string;
}

export async function obtenerHistorialVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string
): Promise<HistorialAsignacionVehiculo[]> {
  await assertAdminPermission(cliente, "vehiculos:leer");
  const { data, error } = await (cliente as unknown as { from: (t: string) => any }).from("historial_vehiculos")
    .select("*")
    .eq("vehiculo_id", vehiculoId)
    .order("cambiado_en", { ascending: false }) as unknown as { data: HistorialAsignacionVehiculo[] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}

export interface ViajeVehiculoResumen {
  id: string;
  creado_en: string;
  estado: string;
  origen: string | null;
  destino: string | null;
  conductor_nombre: string | null;
}

/**
 * Obtiene los viajes asociados al vehículo (vía pasaporte_digital).
 */
export async function obtenerViajesDeVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  limite = 50
): Promise<ViajeVehiculoResumen[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  const { data, error } = await cliente
    .from("pasaporte_digital")
    .select("traslado_id, creado_en, estado, origen_ciudad, destino_ciudad, conductor_nombre")
    .eq("vehiculo_id", vehiculoId)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.traslado_id ?? "",
    creado_en: v.creado_en ?? "",
    estado: v.estado ?? "",
    origen: v.origen_ciudad,
    destino: v.destino_ciudad,
    conductor_nombre: v.conductor_nombre
  }));

}
