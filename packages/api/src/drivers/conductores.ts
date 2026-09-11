import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoDocumentoConductor } from "@ruum/shared/types";
import { consecuenciaCancelacionConductor, consecuenciaNoPresentacion } from "@ruum/shared/rules";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { registrarEvento } from "../services/auditoria";
import { obtenerAdminIdParaAuditoria } from "../identity/admins";
import { cambiarAccesoAuthAdmin } from "../identity/usuarios";
import { esRpcPaginacionNoDisponible } from "../operations/infrastructure/supabase-errores";

type Cliente = SupabaseClient<Database>;
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EstadoConductor = Database["public"]["Enums"]["estado_conductor"];

export async function listarConductoresAdmin(cliente: Cliente): Promise<ConductorRow[]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await cliente.from("conductores").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function validarDocumentoConductor(cliente: Cliente, conductorId: string, aprobado: boolean) {
  await assertAdminPermission(cliente, "conductores:validar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualiza_conductor_documentos",
    args: { p_conductor_id: string; p_aprobado: boolean }
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc("admin_actualiza_conductor_documentos", {
    p_conductor_id: conductorId,
    p_aprobado: aprobado
  });
  if (error) throw error;
}

type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

/** Estados posibles de un documento individual del expediente del conductor. */

export const DOCUMENTOS_OBLIGATORIOS_CONDUCTOR = ["licencia_frente", "licencia_reverso", "identificacion_oficial"] as const;

/** Fase 2 — expediente completo (conductor + documentos) para la vista de detalle del panel admin. */

export async function obtenerDetalleConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<{ conductor: ConductorRow; documentos: DocumentoConductorRow[] }> {
  await assertAdminPermission(cliente, "conductores:leer");
  const [conductor, documentos] = await Promise.all([
    cliente.from("conductores").select("*").eq("id", conductorId).single(),
    cliente
      .from("documentos_conductor")
      .select("*")
      .eq("conductor_id", conductorId)
      .order("creado_en", { ascending: false })
  ]);

  if (conductor.error) throw conductor.error;
  if (documentos.error) throw documentos.error;

  return { conductor: conductor.data, documentos: documentos.data ?? [] };
}

export async function obtenerConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<ConductorRow | null> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await cliente.from("conductores").select("*").eq("id", conductorId).maybeSingle();
  if (error) throw error;
  return data;
}

export type ConductorActualizableAdmin = Pick<
  Database["public"]["Tables"]["conductores"]["Update"],
  "nombre" | "telefono" | "curp" | "licencia_numero" | "licencia_tipo" | "licencia_vigencia" |
  "codigo_postal" | "estado_residencia" | "ciudad_municipio" | "colonia" | "calle" | "numero" |
  "referencias" | "contacto_emergencia_nombre" | "contacto_emergencia_telefono" | "foto_perfil_url"
>;

export async function actualizarConductorAdmin(
  cliente: Cliente,
  conductorId: string,
  datos: ConductorActualizableAdmin
): Promise<ConductorRow> {
  await assertAdminPermission(cliente, "conductores:validar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualizar_conductor_atomic",
    args: { p_conductor_id: string; p_datos: ConductorActualizableAdmin }
  ) => Promise<{ error: unknown }>;
  const { error } = await rpc("admin_actualizar_conductor_atomic", { p_conductor_id: conductorId, p_datos: datos });
  if (error) throw error;
  const { data, error: errorLectura } = await cliente.from("conductores").select("*").eq("id", conductorId).single();
  if (errorLectura) throw errorLectura;
  return data;
}

export async function suspenderConductorAdmin(
  cliente: Cliente,
  conductorId: string,
  motivo: string,
  aprobacionId?: string
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:sancionar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_suspender_conductor",
    args: { p_aprobacion_id: string | null; p_conductor_id: string; p_nuevo_estado: string; p_motivo: string | null }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId ?? null,
    p_conductor_id: conductorId,
    p_nuevo_estado: "suspendido",
    p_motivo: motivo || null
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo suspender al conductor.");
  await registrarEvento(cliente, "suspension_conductor" as never, "admin", conductorId, { motivo });
  await cambiarAccesoAuthAdmin(cliente, "conductor", conductorId, "suspender", motivo);
}

export async function reactivarConductorAdmin(
  cliente: Cliente,
  conductorId: string,
  motivo: string,
  aprobacionId?: string
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:sancionar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_suspender_conductor",
    args: { p_aprobacion_id: string | null; p_conductor_id: string; p_nuevo_estado: string; p_motivo: string | null }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId ?? null,
    p_conductor_id: conductorId,
    p_nuevo_estado: "activo",
    p_motivo: motivo || null
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo reactivar al conductor.");
  await registrarEvento(cliente, "reactivacion_conductor" as never, "admin", conductorId, { motivo });
  await cambiarAccesoAuthAdmin(cliente, "conductor", conductorId, "reactivar", motivo);
}

export async function darBajaConductorAdmin(
  cliente: Cliente,
  conductorId: string,
  motivo: string,
  aprobacionId?: string
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:sancionar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_suspender_conductor",
    args: { p_aprobacion_id: string | null; p_conductor_id: string; p_nuevo_estado: string; p_motivo: string | null }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId ?? null,
    p_conductor_id: conductorId,
    p_nuevo_estado: "baja",
    p_motivo: motivo || null
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo dar de baja al conductor.");
  await registrarEvento(cliente, "baja_conductor" as never, "admin", conductorId, { motivo });
  await cambiarAccesoAuthAdmin(cliente, "conductor", conductorId, "baja", motivo);
}

export type ConductorCrearAdmin = {
  correo: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  curp: string;
  licencia_numero: string;
  licencia_tipo: string;
  licencia_vigencia: string;
  codigo_postal: string;
  estado_residencia: string;
  ciudad_municipio: string;
  colonia: string;
  calle: string;
  numero: string;
  referencias?: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  autoriza_verificacion_antecedentes: boolean;
  declara_sin_suspensiones: boolean;
};

export async function crearConductorAdmin(
  cliente: Cliente,
  datos: ConductorCrearAdmin
): Promise<ConductorRow> {
  await assertAdminPermission(cliente, "conductores:validar");
  const respuesta = await fetch("/api/admin-auth/invitar-conductor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(datos)
  });
  const payload = await respuesta.json().catch(() => ({})) as { conductor?: ConductorRow; mensaje?: string; error?: string };
  if (!respuesta.ok || !payload.conductor) {
    throw new Error(payload.mensaje ?? payload.error ?? "No se pudo invitar y crear al conductor.");
  }
  return payload.conductor;
}

export interface PaginacionConductores {
  data: ConductorRow[];
  paginacion: { pagina: number; tamano: number; total: number; total_paginas: number };
}

export async function listarConductoresAdminPaginados(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  busqueda?: string,
  estado?: EstadoConductor | "todos"
): Promise<PaginacionConductores> {
  await assertAdminPermission(cliente, "conductores:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "listar_conductores_admin_paginados",
    args: { p_pagina: number; p_tamano: number; p_busqueda: string | null; p_estado: string | null }
  ) => Promise<{ data: PaginacionConductores | null; error: unknown }>;
  const { data, error } = await rpc("listar_conductores_admin_paginados", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_busqueda: busqueda?.trim() || null,
    p_estado: estado && estado !== "todos" ? estado : null
  });
  if (error && esRpcPaginacionNoDisponible(error)) {
    return listarConductoresAdminPaginadosFallback(cliente, pagina, tamano, busqueda, estado);
  }
  if (error) throw error;
  if (!data) return { data: [], paginacion: { pagina: 1, tamano: 25, total: 0, total_paginas: 0 } };
  return data;
}

async function listarConductoresAdminPaginadosFallback(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  busqueda?: string,
  estado?: EstadoConductor | "todos"
): Promise<PaginacionConductores> {
  const paginaNormalizada = Math.max(pagina, 1);
  const tamanoNormalizado = Math.min(Math.max(tamano, 1), 100);
  const desde = (paginaNormalizada - 1) * tamanoNormalizado;
  const hasta = desde + tamanoNormalizado - 1;

  let query = cliente
    .from("conductores")
    .select("*", { count: "exact" })
    .order("creado_en", { ascending: false })
    .range(desde, hasta);

  if (estado && estado !== "todos") {
    query = query.eq("estado", estado);
  }

  const termino = busqueda?.trim();
  if (termino) {
    const patron = termino.replace(/%/g, "\\%").replace(/,/g, "\\,");
    query = query.or([
      `nombre.ilike.%${patron}%`,
      `telefono.ilike.%${patron}%`,
      `curp.ilike.%${patron}%`,
      `licencia_numero.ilike.%${patron}%`
    ].join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const total = count ?? data?.length ?? 0;
  return {
    data: data ?? [],
    paginacion: {
      pagina: paginaNormalizada,
      tamano: tamanoNormalizado,
      total,
      total_paginas: total === 0 ? 0 : Math.ceil(total / tamanoNormalizado)
    }
  };
}

/**
 * Valida si una CURP ya existe en conductores o usuarios.
 */

export async function validarCurpUnica(
  cliente: Cliente,
  curp: string,
  excluirId?: string
): Promise<{ unica: boolean; conflictoEn: "conductor" | "usuario" | null }> {
  const curpNorm = curp.toUpperCase().trim();
  const [conductor, usuario] = await Promise.all([
    (cliente as unknown as { from: (t: string) => any }).from("conductores").select("id").eq("curp", curpNorm).maybeSingle() as unknown as Promise<{ data: { id: string } | null }>,
    (cliente as unknown as { from: (t: string) => any }).from("usuarios").select("id").eq("curp", curpNorm).maybeSingle() as unknown as Promise<{ data: { id: string } | null }>
  ]);
  const conductorExiste = conductor.data && (!excluirId || conductor.data.id !== excluirId);
  const usuarioExiste = usuario.data && (!excluirId || usuario.data.id !== excluirId);
  if (conductorExiste) return { unica: false, conflictoEn: "conductor" };
  if (usuarioExiste) return { unica: false, conflictoEn: "usuario" };
  return { unica: true, conflictoEn: null };
}

/**
 * Valida si un número de licencia ya existe.
 */
export async function validarLicenciaUnica(
  cliente: Cliente,
  licencia: string,
  excluirId?: string
): Promise<boolean> {
  const licNorm = licencia.trim().toUpperCase();
  const { data, error } = await cliente
    .from("conductores")
    .select("id")
    .eq("licencia_numero", licNorm)
    .maybeSingle();
  if (error) throw error;
  if (data && (!excluirId || data.id !== excluirId)) return false;
  return true;
}

/**
 * Valida formato de CURP mexicana (18 caracteres alfanuméricos).
 */
export function validarFormatoCurp(curp: string): boolean {
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d$/.test(curp.toUpperCase().trim());
}

/**
 * Valida formato de licencia (alfanumérico, 6-12 caracteres).
 */
export function validarFormatoLicencia(licencia: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(licencia.trim().toUpperCase());
}

/**
 * Verifica si un documento de identidad está vigente y aprobado.
 */
export async function verificarDocumentoIdentidadVigente(
  cliente: Cliente,
  conductorId: string
): Promise<{ vigente: boolean; documentoId?: string; expiraEn?: string }> {
  const { data, error } = await cliente
    .from("documentos_conductor")
    .select("id, estado, expira_en")
    .eq("conductor_id", conductorId)
    .eq("tipo", "identificacion_oficial")
    .eq("estado", "aprobado")
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { vigente: false };
  const ahora = new Date();
  const expira = data.expira_en ? new Date(data.expira_en) : null;
  if (expira && expira < ahora) return { vigente: false, documentoId: data.id, expiraEn: data.expira_en ?? undefined };
  return { vigente: true, documentoId: data.id, expiraEn: data.expira_en ?? undefined };
}

/**
 * Obtiene todos los documentos actuales de un conductor con estado y vigencia.
 */
export async function obtenerDocumentosConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<Database["public"]["Tables"]["documentos_conductor"]["Row"][]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await cliente
    .from("documentos_conductor")
    .select("*")
    .eq("conductor_id", conductorId)
    .eq("es_actual", true)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Genera URL firmada para un documento de conductor.
 */
export async function obtenerUrlDocumentoConductor(
  cliente: Cliente,
  storagePath: string,
  expiracionSegundos = 1800
): Promise<string> {
  const { data, error } = await cliente.storage
    .from("documentos-conductor")
    .createSignedUrl(storagePath, expiracionSegundos);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Obtiene un vehículo por ID con validaciones.
 */

export async function obtenerVehiculosDeConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"][]> {
  await assertAdminPermission(cliente, "vehiculos:leer");
  const { data, error } = await (cliente as unknown as { from: (t: string) => any }).from("vehiculos")
    .select("*")
    .eq("conductor_id", conductorId)
    .order("creado_en", { ascending: false }) as unknown as { data: Database["public"]["Tables"]["vehiculos"]["Row"][] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}

/**
 * Obtiene la empresa vinculada al conductor (si tiene).

/**
 * Obtiene la empresa vinculada al conductor (si tiene).
 */
export async function obtenerEmpresaDeConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<Database["public"]["Tables"]["empresas"]["Row"] | null> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data: conductor, error: errC } = await cliente
    .from("conductores")
    .select("empresa_id")
    .eq("id", conductorId)
    .maybeSingle();
  if (errC) throw errC;
  if (!conductor?.empresa_id) return null;
  const { data, error } = await cliente
    .from("empresas")
    .select("*")
    .eq("id", conductor.empresa_id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Historial de cambios de estado del conductor.
 */

export interface HistorialEstatusConductor {
  id: string;
  conductor_id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  motivo: string | null;
  cambiado_por: string;
  cambiado_en: string;
}

export async function obtenerHistorialEstatusConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<HistorialEstatusConductor[]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await (cliente as unknown as { from: (t: string) => any }).from("historial_estatus_conductor")
    .select("*")
    .eq("conductor_id", conductorId)
    .order("cambiado_en", { ascending: false }) as unknown as { data: HistorialEstatusConductor[] | null; error: unknown };
  if (error) throw error;
  return data ?? [];
}

/**
 * Registra un cambio de estado del conductor (interno, llamado desde suspender/reactivar/baja).
 */
export async function registrarCambioEstatusConductor(
  cliente: Cliente,
  conductorId: string,
  estadoAnterior: string | null,
  estadoNuevo: string,
  motivo: string | null,
  adminId: string
): Promise<void> {
  const { error } = await (cliente as unknown as { from: (t: string) => any }).from("historial_estatus_conductor").insert({
    conductor_id: conductorId,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    motivo,
    cambiado_por: adminId
  }) as unknown as { error: unknown };
  if (error) throw error;
}

/**
 * Obtiene alertas de vencimiento próximas (30 días) para documentos de conductor.
 */
export interface AlertaVencimientoConductor {
  conductor_id: string;
  conductor_nombre: string;
  tipo_documento: string;
  documento_id: string;
  expira_en: string;
  dias_restantes: number;
}

export async function obtenerAlertasVencimientoConductores(
  cliente: Cliente,
  diasAnticipacion = 30
): Promise<AlertaVencimientoConductor[]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion);
  const { data, error } = await cliente
    .from("documentos_conductor")
    .select("id, conductor_id, tipo, expira_en, conductores!inner(nombre)")
    .eq("es_actual", true)
    .eq("estado", "aprobado")
    .not("expira_en", "is", null)
    .lte("expira_en", fechaLimite.toISOString())
    .gte("expira_en", new Date().toISOString());
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    conductor_id: d.conductor_id,
    conductor_nombre: d.conductores?.nombre ?? "Desconocido",
    tipo_documento: d.tipo,
    documento_id: d.id,
    expira_en: d.expira_en,
    dias_restantes: Math.ceil((new Date(d.expira_en).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }));
}

/**
 * Verifica vigencias de todos los documentos obligatorios de un conductor.
 */
export async function verificarVigenciasDocumentosConductor(
  cliente: Cliente,
  conductorId: string
): Promise<{
  licencia_frente: { vigente: boolean; expira_en: string | null };
  licencia_reverso: { vigente: boolean; expira_en: string | null };
  identificacion_oficial: { vigente: boolean; expira_en: string | null };
}> {
  const docs = await obtenerDocumentosConductorAdmin(cliente, conductorId);
  const obligatorios = ["licencia_frente", "licencia_reverso", "identificacion_oficial"] as const;
  const resultado: any = {};
  for (const tipo of obligatorios) {
    const doc = docs.find((d) => d.tipo === tipo && d.estado === "aprobado");
    if (!doc) {
      resultado[tipo] = { vigente: false, expira_en: null };
      continue;
    }
    const ahora = new Date();
    const expira = doc.expira_en ? new Date(doc.expira_en) : null;
    resultado[tipo] = { vigente: !expira || expira >= ahora, expira_en: doc.expira_en };
  }
  return resultado;
}

export async function cambiarEstadoConductorAdmin(
  cliente: Cliente,
  conductorId: string,
  nuevoEstado: EstadoConductor,
  aprobacionId?: string,
  motivo?: string
) {
  await assertAdminPermission(cliente, "conductores:sancionar");
  if (!aprobacionId) {
    throw new Error("Esta operación requiere una aprobación dual válida (aprobacionId).");
  }

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_suspender_conductor",
    args: { p_aprobacion_id: string; p_conductor_id: string; p_nuevo_estado: string; p_motivo: string | null }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_nuevo_estado: nuevoEstado,
    p_motivo: motivo || null
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo suspender al conductor.");
}

export async function registrarNoPresentacionConductor(
  cliente: Cliente,
  conductorId: string,
  aprobacionId?: string
) {
  await assertAdminPermission(cliente, "conductores:sancionar");
  if (!aprobacionId) {
    throw new Error("Esta operación requiere una aprobación dual válida (aprobacionId).");
  }

  const { data: conductor, error: errorConductor } = await cliente
    .from("conductores")
    .select("id, no_presentaciones_6m")
    .eq("id", conductorId)
    .maybeSingle();
  if (errorConductor) throw errorConductor;
  if (!conductor) throw new Error("No se encontró el conductor.");

  const ocurrencias = conductor.no_presentaciones_6m + 1;
  const consecuencia = consecuenciaNoPresentacion(ocurrencias);

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_registrar_no_presentacion",
    args: { p_aprobacion_id: string; p_conductor_id: string; p_ocurrencias: number; p_nuevo_estado: string }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_registrar_no_presentacion", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_ocurrencias: ocurrencias,
    p_nuevo_estado: consecuencia.nuevoEstado
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo registrar la no presentación.");

  return consecuencia;
}

export async function registrarCancelacionConductor(
  cliente: Cliente,
  conductorId: string,
  conJustificacion: boolean,
  aprobacionId?: string
) {
  await assertAdminPermission(cliente, "conductores:sancionar");

  if (conJustificacion) {
    const adminId = await obtenerAdminIdParaAuditoria(cliente);
    await registrarEvento(cliente, "suspension_conductor", "admin", adminId, {
      conductor_id: conductorId,
      tipo: "cancelacion_conductor",
      con_justificacion: true,
      mensaje: "Cancelación de conductor registrada con justificación; no aplica consecuencia."
    });
    return null;
  }

  if (!aprobacionId) {
    throw new Error("Esta operación requiere una aprobación dual válida (aprobacionId).");
  }

  const { data: conductor, error: errorConductor } = await cliente
    .from("conductores")
    .select("id, cancelaciones_sin_justificacion_count")
    .eq("id", conductorId)
    .maybeSingle();
  if (errorConductor) throw errorConductor;
  if (!conductor) throw new Error("No se encontró el conductor.");

  const cancelaciones = conductor.cancelaciones_sin_justificacion_count + 1;
  const consecuencia = consecuenciaCancelacionConductor(cancelaciones);

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_registrar_cancelacion_injustificada",
    args: { p_aprobacion_id: string; p_conductor_id: string; p_cancelaciones: number; p_nuevo_estado: string }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_registrar_cancelacion_injustificada", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_cancelaciones: cancelaciones,
    p_nuevo_estado: consecuencia.nuevoEstado
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo registrar la cancelación.");

  return consecuencia;
}
