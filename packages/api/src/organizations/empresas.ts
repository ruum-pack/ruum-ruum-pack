import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { registrarEvento } from "../services/auditoria";
import { obtenerAdminIdParaAuditoria } from "../identity/admins";
import { esRecursoSupabasePendiente } from "../operations/infrastructure/supabase-errores";

type Cliente = SupabaseClient<Database>;
type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type EmpresaDocumentoRow = Database["public"]["Tables"]["empresas_documentos"]["Row"];
type EmpresaDatosFiscalesVersionRow = Database["public"]["Tables"]["empresas_datos_fiscales_versiones"]["Row"];
type EmpresaCondicionesVersionRow = Database["public"]["Tables"]["empresas_condiciones_comerciales_versiones"]["Row"];
type EmpresaCambioSensibleRow = Database["public"]["Tables"]["empresas_cambios_sensibles"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];

export interface DatosEmpresasAdmin {
  empresas: EmpresaRow[];
  usuarios: UsuarioRow[];
  traslados: TrasladoRow[];
  vehiculos: VehiculoRow[];
  conductores: ConductorRow[];
  documentos: EmpresaDocumentoRow[];
  versionesFiscales: EmpresaDatosFiscalesVersionRow[];
  versionesCondiciones: EmpresaCondicionesVersionRow[];
  cambiosSensibles: EmpresaCambioSensibleRow[];
}

export interface AltaEmpresaCorporativa {
  empresa: {
    nombre: string;
    rfc: string;
    razon_social?: string;
    regimen_fiscal?: string;
    codigo_postal_fiscal?: string;
    uso_cfdi?: string;
    correo_facturacion?: string;
    condiciones_pago?: string;
    estado_verificacion?: EstadoVerificacion;
    limite_credito_mxn?: number;
    credito_disponible_mxn?: number;
    dias_credito?: number;
    requiere_orden_compra?: boolean;
  };
  titular: {
    nombre: string;
    telefono?: string;
    correo_facturacion: string;
    estado_verificacion?: EstadoVerificacion;
    metodo_pago_registrado?: boolean;
  };
}

export interface ResultadoAltaEmpresaCorporativa {
  empresa_id: string;
  usuario_id: string;
}

const RFC_MEXICO_FORMAL = /^([A-Z&Ñ]{3}|[A-Z&Ñ]{4})\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/;
const CORREO_BASICO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listarEmpresasAdmin(cliente: Cliente): Promise<DatosEmpresasAdmin> {
  await assertAdminPermission(cliente, "empresas:leer");
  const [empresas, usuarios, traslados, vehiculos, conductores, documentos, versionesFiscales, versionesCondiciones, cambiosSensibles] = await Promise.all([
    cliente.from("empresas").select("*").order("creado_en", { ascending: false }),
    cliente
      .from("usuarios")
      .select("*")
      .not("empresa_id", "is", null)
      .in("rol", ["titular_empresa", "usuario_autorizado"])
      .order("creado_en", { ascending: false }),
    cliente.from("traslados").select("*").order("creado_en", { ascending: false }),
    cliente.from("vehiculos").select("*").not("empresa_id", "is", null).order("creado_en", { ascending: false }),
    cliente.from("conductores").select("*").not("empresa_id", "is", null).order("creado_en", { ascending: false }),
    cliente.from("empresas_documentos").select("*").order("creado_en", { ascending: false }),
    cliente.from("empresas_datos_fiscales_versiones").select("*").order("version", { ascending: false }),
    cliente.from("empresas_condiciones_comerciales_versiones").select("*").order("version", { ascending: false }),
    cliente.from("empresas_cambios_sensibles").select("*").order("solicitado_en", { ascending: false })
  ]);

  for (const resultado of [empresas, usuarios, traslados]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    empresas: empresas.data ?? [],
    usuarios: usuarios.data ?? [],
    traslados: traslados.data ?? [],
    vehiculos: resultadoOpcional(vehiculos),
    conductores: resultadoOpcional(conductores),
    documentos: resultadoOpcional(documentos),
    versionesFiscales: resultadoOpcional(versionesFiscales),
    versionesCondiciones: resultadoOpcional(versionesCondiciones),
    cambiosSensibles: resultadoOpcional(cambiosSensibles)
  };
}

function resultadoOpcional<T>(resultado: { data: T[] | null; error: unknown }): T[] {
  if (!resultado.error) return resultado.data ?? [];
  if (esRecursoSupabasePendiente(resultado.error)) return [];
  throw resultado.error;
}

function numeroCorporativo(valor: number | null | undefined, etiqueta: string): number | undefined {
  if (valor === undefined || valor === null) return valor === null ? 0 : undefined;
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`${etiqueta} debe ser un número mayor o igual a cero.`);
  return valor;
}

function errorAltaEmpresa(error: Error): Error {
  const mensaje = String(error.message || error);
  if (/PERMISO_INSUFICIENTE|Acceso denegado|42501|ADMIN_PERMISSION_DENIED|empresas:gestionar/i.test(mensaje)) {
    return new Error("Tu rol no tiene permiso para crear empresas corporativas.");
  }
  if (/RFC inválido/i.test(mensaje)) return new Error("Captura un RFC mexicano formalmente válido.");
  if (/Ya existe una empresa con ese RFC|23505|empresas_rfc_unico/i.test(mensaje)) {
    return new Error("Ya existe una empresa con ese RFC.");
  }
  if (/Nombre comercial requerido/i.test(mensaje)) return new Error("Captura el nombre comercial de la empresa.");
  if (/Nombre del titular requerido/i.test(mensaje)) return new Error("Captura el nombre del titular.");
  if (/Correo del titular requerido/i.test(mensaje)) return new Error("Captura el correo del titular.");
  return error;
}

export async function crearEmpresaCorporativaAdmin(
  cliente: Cliente,
  datos: AltaEmpresaCorporativa
): Promise<ResultadoAltaEmpresaCorporativa> {
  try {
    await assertAdminPermission(cliente, "empresas:gestionar");
  } catch (error) {
    throw errorAltaEmpresa(error instanceof Error ? error : new Error("No se pudo validar el permiso administrativo."));
  }
  const nombre = datos.empresa.nombre.trim();
  const rfc = datos.empresa.rfc.trim().toUpperCase();
  const titularNombre = datos.titular.nombre.trim();
  const titularCorreo = datos.titular.correo_facturacion.trim().toLowerCase();
  const correoFacturacion = (datos.empresa.correo_facturacion || titularCorreo).trim().toLowerCase();
  if (!nombre) throw new Error("Captura el nombre comercial de la empresa.");
  if (!rfc) throw new Error("Captura el RFC de la empresa.");
  if (!RFC_MEXICO_FORMAL.test(rfc)) throw new Error("Captura un RFC mexicano formalmente válido.");
  if (!titularNombre) throw new Error("Captura el nombre del titular.");
  if (!titularCorreo) throw new Error("Captura el correo del titular.");
  if (!CORREO_BASICO.test(titularCorreo)) throw new Error("Captura un correo válido para el titular.");
  if (correoFacturacion && !CORREO_BASICO.test(correoFacturacion)) throw new Error("Captura un correo de facturación válido.");
  const limiteCredito = numeroCorporativo(datos.empresa.limite_credito_mxn, "El límite de crédito");
  const creditoDisponible = numeroCorporativo(datos.empresa.credito_disponible_mxn, "El crédito disponible");
  const diasCredito = numeroCorporativo(datos.empresa.dias_credito, "Los días de crédito");

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_crea_empresa_corporativa",
    args: { p_empresa: AltaEmpresaCorporativa["empresa"]; p_titular: AltaEmpresaCorporativa["titular"] }
  ) => Promise<{ data: ResultadoAltaEmpresaCorporativa | null; error: Error | null }>;

  const { data, error } = await rpc("admin_crea_empresa_corporativa", {
    p_empresa: {
      ...datos.empresa,
      nombre,
      rfc,
      correo_facturacion: correoFacturacion,
      limite_credito_mxn: limiteCredito,
      credito_disponible_mxn: creditoDisponible ?? limiteCredito ?? 0,
      dias_credito: diasCredito
    },
    p_titular: {
      ...datos.titular,
      nombre: titularNombre,
      correo_facturacion: titularCorreo
    }
  });
  if (error) throw errorAltaEmpresa(error);
  if (!data) throw new Error("No se pudo confirmar el alta corporativa.");
  return data;
}

export async function validarDocumentoEmpresa(
  cliente: Cliente,
  empresaId: string,
  estadoVerificacion: EstadoVerificacion,
  condicionesPago: string
) {
  await assertAdminPermission(cliente, "empresas:gestionar");
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente
    .from("empresas")
    .update({ estado_verificacion: estadoVerificacion })
    .eq("id", empresaId);

  if (error) throw error;

  if (condicionesPago.trim()) {
    await actualizarEmpresaCorporativaAdmin(
      cliente,
      empresaId,
      { condiciones_pago: condicionesPago.trim() },
      "Validación documental y condiciones de pago"
    );
  }

  await registrarEvento(cliente, "validacion_documentos", "admin", adminId, {
    empresa_id: empresaId,
    estado_verificacion: estadoVerificacion
  });
}

export async function actualizarEmpresaCorporativaAdmin(
  cliente: Cliente,
  empresaId: string,
  datos: ActualizacionEmpresaCorporativa,
  motivo: string
) {
  await assertAdminPermission(cliente, "empresas:gestionar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualiza_empresa_corporativa",
    args: { p_empresa_id: string; p_datos: ActualizacionEmpresaCorporativa; p_motivo: string }
  ) => Promise<{ data: { empresa_id: string; cambio_fiscal_id: string | null; cambio_condiciones_id: string | null } | null; error: Error | null }>;

  const { data, error } = await rpc("admin_actualiza_empresa_corporativa", {
    p_empresa_id: empresaId,
    p_datos: datos,
    p_motivo: motivo.trim() || "Actualización operativa"
  });
  if (error) throw error;
  return data;
}

export async function cambiarEstadoEmpresaAdmin(
  cliente: Cliente,
  empresaId: string,
  estadoOperativo: "activa" | "suspendida",
  motivo: string
) {
  await assertAdminPermission(cliente, "empresas:gestionar");
  if (!motivo.trim()) throw new Error("Captura el motivo del cambio de estado.");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_cambia_estado_empresa",
    args: { p_empresa_id: string; p_estado_operativo: "activa" | "suspendida"; p_motivo: string }
  ) => Promise<{ data: { empresa_id: string; estado_operativo: "activa" | "suspendida" } | null; error: Error | null }>;

  const { data, error } = await rpc("admin_cambia_estado_empresa", {
    p_empresa_id: empresaId,
    p_estado_operativo: estadoOperativo,
    p_motivo: motivo.trim()
  });
  if (error) throw error;
  return data;
}

export async function guardarUsuarioEmpresaAdmin(cliente: Cliente, empresaId: string, usuario: UsuarioEmpresaAdmin) {
  await assertAdminPermission(cliente, "empresas:gestionar");
  if (!usuario.nombre.trim()) throw new Error("Captura el nombre del usuario empresarial.");
  if (!usuario.correo_facturacion?.trim() && !usuario.telefono?.trim()) throw new Error("Captura correo o teléfono del usuario empresarial.");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_guarda_usuario_empresa",
    args: { p_empresa_id: string; p_usuario: UsuarioEmpresaAdmin }
  ) => Promise<{ data: { empresa_id: string; usuario_id: string } | null; error: Error | null }>;

  const { data, error } = await rpc("admin_guarda_usuario_empresa", {
    p_empresa_id: empresaId,
    p_usuario: usuario
  });
  if (error) throw error;
  return data;
}

export async function guardarDocumentoEmpresaAdmin(cliente: Cliente, empresaId: string, documento: DocumentoEmpresaAdmin) {
  await assertAdminPermission(cliente, "empresas:gestionar");
  if (!documento.nombre.trim()) throw new Error("Captura el nombre del documento.");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_guarda_documento_empresa",
    args: { p_empresa_id: string; p_documento: DocumentoEmpresaAdmin }
  ) => Promise<{ data: { empresa_id: string; documento_id: string } | null; error: Error | null }>;

  const { data, error } = await rpc("admin_guarda_documento_empresa", {
    p_empresa_id: empresaId,
    p_documento: documento
  });
  if (error) throw error;
  return data;
}

export async function resolverCambioEmpresaAdmin(cliente: Cliente, cambioId: string, aprobar: boolean, comentario: string) {
  await assertAdminPermission(cliente, "empresas:gestionar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_resuelve_cambio_empresa",
    args: { p_cambio_id: string; p_aprobar: boolean; p_comentario: string | null }
  ) => Promise<{ data: { cambio_id: string; estado: "aprobado" | "rechazado"; version?: number } | null; error: Error | null }>;

  const { data, error } = await rpc("admin_resuelve_cambio_empresa", {
    p_cambio_id: cambioId,
    p_aprobar: aprobar,
    p_comentario: comentario.trim() || null
  });
  if (error) throw error;
  return data;
}


export interface ActualizacionEmpresaCorporativa {
  nombre?: string;
  rfc?: string;
  razon_social?: string;
  regimen_fiscal?: string;
  codigo_postal_fiscal?: string;
  uso_cfdi?: string;
  correo_facturacion?: string;
  condiciones_pago?: string;
  limite_credito_mxn?: number;
  credito_disponible_mxn?: number;
  dias_credito?: number;
  requiere_orden_compra?: boolean;
}

export interface UsuarioEmpresaAdmin {
  id?: string;
  rol: "titular_empresa" | "usuario_autorizado";
  nombre: string;
  telefono?: string;
  correo_facturacion?: string;
  metodo_pago_registrado?: boolean;
}

export interface DocumentoEmpresaAdmin {
  tipo: string;
  nombre: string;
  folio?: string;
  url?: string;
  estado?: EstadoVerificacion;
  vigente_desde?: string;
  vigente_hasta?: string;
  notas?: string;
}
