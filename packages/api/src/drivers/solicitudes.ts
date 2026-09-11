import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoDocumentoConductor } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { transicionValida } from "@ruum/shared/states";
import { registrarEvento } from "../services/auditoria";
import { obtenerAdminIdParaAuditoria } from "../identity/admins";
import { DOCUMENTOS_OBLIGATORIOS_CONDUCTOR, obtenerDetalleConductorAdmin } from "./conductores";

type Cliente = SupabaseClient<Database>;
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type SolicitudConductorRow = Database["public"]["Tables"]["solicitudes_conductor"]["Row"];
type ConsentimientoUsuarioRow = Database["public"]["Tables"]["consentimientos_usuario"]["Row"];
type HistorialSolicitudRow = Database["public"]["Tables"]["historial_estados_solicitud_conductor"]["Row"];
type NotaInternaSolicitudConductorRow = Database["public"]["Tables"]["notas_internas_solicitud_conductor"]["Row"];
type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

export interface SolicitudConductorBandejaAdmin {
  solicitud: SolicitudConductorRow;
  nombre: string;
  telefono: string | null;
  curp: string | null;
  documentos: DocumentoConductorResumenAdmin[];
  documentosVigentes: number;
  documentosRechazados: number;
  consentimientosRegistrados: number;
  ultimaDecision: HistorialSolicitudRow | null;
}

export interface DocumentoConductorResumenAdmin {
  id: string;
  tipo: string;
  estado: string;
  nombre_archivo: string;
  expira_en: string | null;
}

export interface HistorialSolicitudConRevisor extends HistorialSolicitudRow {
  revisor_nombre: string | null;
}

export interface NotaInternaSolicitudConAdmin extends NotaInternaSolicitudConductorRow {
  admin_nombre: string | null;
}

export interface DetalleSolicitudConductorAdmin {
  solicitud: SolicitudConductorRow;
  conductor: ConductorRow | null;
  documentos: DocumentoConductorRow[];
  consentimientos: ConsentimientoUsuarioRow[];
  historial: HistorialSolicitudConRevisor[];
  notasInternas: NotaInternaSolicitudConAdmin[];
}

/** Admin asociado a la sesión de Supabase Auth actual, si existe (mismo patrón que obtenerUsuarioActual/obtenerConductorActual). */

function valorTextoJson(valor: unknown, llave: string): string | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const dato = (valor as Record<string, unknown>)[llave];
  return typeof dato === "string" && dato.trim() ? dato.trim() : null;
}

/** RT-23 — la bandeja se construye exclusivamente desde expedientes y sus relaciones. */

export async function listarSolicitudesConductorAdmin(cliente: Cliente): Promise<SolicitudConductorBandejaAdmin[]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const [solicitudes, documentos, consentimientos, historial] = await Promise.all([
    cliente.from("solicitudes_conductor").select("*").order("actualizado_en", { ascending: false }),
    cliente.from("documentos_conductor").select("*").eq("es_actual", true),
    cliente.from("consentimientos_usuario").select("*"),
    cliente.from("historial_estados_solicitud_conductor").select("*").order("revisado_en", { ascending: false })
  ]);

  for (const resultado of [solicitudes, documentos, consentimientos, historial]) {
    if (resultado.error) throw resultado.error;
  }

  const filas = solicitudes.data ?? [];
  const solicitudPorConductor = new Map(
    filas.filter((s) => s.conductor_id).map((s) => [s.conductor_id as string, s.id])
  );
  const documentosPorSolicitud = new Map<string, DocumentoConductorRow[]>();
  for (const documento of documentos.data ?? []) {
    const solicitudId = documento.solicitud_id ?? (documento.conductor_id ? solicitudPorConductor.get(documento.conductor_id) : null);
    if (!solicitudId) continue;
    documentosPorSolicitud.set(solicitudId, [...(documentosPorSolicitud.get(solicitudId) ?? []), documento]);
  }
  const consentimientosPorSolicitud = new Map<string, Set<string>>();
  for (const consentimiento of consentimientos.data ?? []) {
    if (!consentimiento.solicitud_id) continue;
    const tipos = consentimientosPorSolicitud.get(consentimiento.solicitud_id) ?? new Set<string>();
    tipos.add(consentimiento.tipo_documento);
    consentimientosPorSolicitud.set(consentimiento.solicitud_id, tipos);
  }
  const ultimaDecisionPorSolicitud = new Map<string, HistorialSolicitudRow>();
  for (const evento of historial.data ?? []) {
    if (!ultimaDecisionPorSolicitud.has(evento.solicitud_id)) {
      ultimaDecisionPorSolicitud.set(evento.solicitud_id, evento);
    }
  }

  return filas.map((solicitud) => {
    const documentosActuales = documentosPorSolicitud.get(solicitud.id) ?? [];
    return {
      solicitud,
      nombre: valorTextoJson(solicitud.datos_personales, "nombre") ?? "Conductor sin nombre",
      telefono: valorTextoJson(solicitud.datos_personales, "telefono") ?? solicitud.telefono_normalizado,
      curp: solicitud.curp_normalizada,
      documentos: documentosActuales.map((documento) => ({
        id: documento.id,
        tipo: documento.tipo,
        estado: documento.estado,
        nombre_archivo: documento.nombre_archivo,
        expira_en: documento.expira_en
      })),
      documentosVigentes: documentosActuales.length,
      documentosRechazados: documentosActuales.filter((d) => d.estado === "rechazado").length,
      consentimientosRegistrados: consentimientosPorSolicitud.get(solicitud.id)?.size ?? 0,
      ultimaDecision: ultimaDecisionPorSolicitud.get(solicitud.id) ?? null
    };
  });
}

/** PRD §17.5 — lista de usuarios. */

export interface PaginacionSolicitudesConductorAdmin {
  data: SolicitudConductorBandejaAdmin[];
  paginacion: { pagina: number; tamano: number; total: number; total_paginas: number };
}

export async function listarSolicitudesConductorAdminPaginadas(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  filtro = "todas",
  busqueda?: string
): Promise<PaginacionSolicitudesConductorAdmin> {
  await assertAdminPermission(cliente, "conductores:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_listar_solicitudes_conductor_paginadas",
    args: { p_pagina: number; p_tamano: number; p_filtro: string; p_busqueda: string | null }
  ) => Promise<{ data: PaginacionSolicitudesConductorAdmin | null; error: unknown }>;
  const { data, error } = await rpc("admin_listar_solicitudes_conductor_paginadas", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_filtro: filtro,
    p_busqueda: busqueda?.trim() || null
  });
  if (error) throw error;
  const resultado = data ?? { data: [], paginacion: { pagina: 1, tamano, total: 0, total_paginas: 0 } };
  if (resultado.data.length === 0) return resultado;

  const solicitudIds = resultado.data.map((fila) => fila.solicitud.id);
  const conductorIds = resultado.data.map((fila) => fila.solicitud.conductor_id).filter(Boolean) as string[];
  const filtroDocumentos = [
    solicitudIds.length ? `solicitud_id.in.(${solicitudIds.join(",")})` : null,
    conductorIds.length ? `conductor_id.in.(${conductorIds.join(",")})` : null
  ].filter(Boolean).join(",");

  if (!filtroDocumentos) return resultado;

  const { data: documentos, error: errorDocumentos } = await cliente
    .from("documentos_conductor")
    .select("id,tipo,estado,nombre_archivo,expira_en,solicitud_id,conductor_id")
    .or(filtroDocumentos)
    .eq("es_actual", true)
    .order("creado_en", { ascending: false });
  if (errorDocumentos) throw errorDocumentos;

  const solicitudPorConductor = new Map(
    resultado.data
      .filter((fila) => fila.solicitud.conductor_id)
      .map((fila) => [fila.solicitud.conductor_id as string, fila.solicitud.id])
  );
  const documentosPorSolicitud = new Map<string, DocumentoConductorResumenAdmin[]>();
  for (const documento of documentos ?? []) {
    const solicitudId = documento.solicitud_id ?? (documento.conductor_id ? solicitudPorConductor.get(documento.conductor_id) : null);
    if (!solicitudId) continue;
    const actuales = documentosPorSolicitud.get(solicitudId) ?? [];
    actuales.push({
      id: documento.id,
      tipo: documento.tipo,
      estado: documento.estado,
      nombre_archivo: documento.nombre_archivo,
      expira_en: documento.expira_en
    });
    documentosPorSolicitud.set(solicitudId, actuales);
  }

  return {
    ...resultado,
    data: resultado.data.map((fila) => {
      const resumen = documentosPorSolicitud.get(fila.solicitud.id) ?? fila.documentos ?? [];
      return {
        ...fila,
        documentos: resumen,
        documentosVigentes: resumen.length || fila.documentosVigentes,
        documentosRechazados: resumen.filter((documento) => documento.estado === "rechazado").length || fila.documentosRechazados
      };
    })
  };
}

/** Torre de Control — inventario operativo de vehículos registrados por usuarios. */

export async function obtenerDetalleSolicitudConductorAdmin(
  cliente: Cliente,
  solicitudId: string
): Promise<DetalleSolicitudConductorAdmin> {
  await assertAdminPermission(cliente, "conductores:leer");
  const solicitud = await cliente.from("solicitudes_conductor").select("*").eq("id", solicitudId).single();
  if (solicitud.error) throw solicitud.error;

  const filtroDocumentos = solicitud.data.conductor_id
    ? `solicitud_id.eq.${solicitudId},conductor_id.eq.${solicitud.data.conductor_id}`
    : `solicitud_id.eq.${solicitudId}`;
  const [documentos, consentimientos, historial, admins, conductor, notasInternas] = await Promise.all([
    cliente
      .from("documentos_conductor")
      .select("*")
      .or(filtroDocumentos)
      .eq("es_actual", true)
      .order("creado_en", { ascending: false }),
    cliente
      .from("consentimientos_usuario")
      .select("*")
      .eq("solicitud_id", solicitudId)
      .order("aceptado_en", { ascending: false }),
    cliente
      .from("historial_estados_solicitud_conductor")
      .select("*")
      .eq("solicitud_id", solicitudId)
      .order("revisado_en", { ascending: false }),
    cliente.from("admins").select("id,nombre"),
    solicitud.data.conductor_id
      ? cliente.from("conductores").select("*").eq("id", solicitud.data.conductor_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    cliente
      .from("notas_internas_solicitud_conductor")
      .select("*")
      .eq("solicitud_id", solicitudId)
      .order("creado_en", { ascending: true })
  ]);

  for (const resultado of [documentos, consentimientos, historial, admins, conductor]) {
    if (resultado.error) throw resultado.error;
  }
  const nombreAdmin = new Map((admins.data ?? []).map((admin) => [admin.id, admin.nombre]));
  const errorNotas = notasInternas.error as { code?: string; message?: string } | null;
  if (errorNotas && !["42P01", "PGRST205"].includes(errorNotas.code ?? "")) throw notasInternas.error;

  return {
    solicitud: solicitud.data,
    conductor: conductor.data ?? null,
    documentos: documentos.data ?? [],
    consentimientos: consentimientos.data ?? [],
    historial: (historial.data ?? []).map((evento) => ({
      ...evento,
      revisor_nombre: evento.revisado_por ? nombreAdmin.get(evento.revisado_por) ?? "Administrador" : null
    })),
    notasInternas: ((notasInternas.data ?? []) as NotaInternaSolicitudConductorRow[]).map((nota) => ({
      ...nota,
      admin_nombre: nota.admin_id ? nombreAdmin.get(nota.admin_id) ?? "Administrador" : null
    }))
  };
}

export async function crearNotaInternaSolicitudConductorAdmin(
  cliente: Cliente,
  solicitudId: string,
  mensaje: string
): Promise<NotaInternaSolicitudConAdmin> {
  await assertAdminPermission(cliente, "conductores:leer");
  const limpio = mensaje.trim();
  if (!limpio) throw new Error("Escribe un mensaje para el chat interno.");
  if (limpio.length > 1000) throw new Error("El mensaje no puede superar 1000 caracteres.");
  const adminId = await obtenerAdminIdParaAuditoria(cliente);

  const { data, error } = await cliente
    .from("notas_internas_solicitud_conductor")
    .insert({ solicitud_id: solicitudId, admin_id: adminId, mensaje: limpio })
    .select("*")
    .single();
  if (error) throw error;
  const admin = await cliente.from("admins").select("nombre").eq("id", adminId).maybeSingle();

  return {
    ...data,
    admin_nombre: admin.data?.nombre ?? "Administrador"
  };
}

/**
 * Fase 2 — revisión granular por documento. Exige motivo cuando el resultado
 * no es "aprobado" (el conductor necesita saber qué corregir). Audita cada acción.
 */
export async function revisarDocumentoConductorAdmin(
  cliente: Cliente,
  documentoId: string,
  estado: EstadoDocumentoConductor,
  notas?: string
) {
  await assertAdminPermission(cliente, "conductores:validar");
  const motivo = notas?.trim() ?? "";
  if (estado !== "aprobado" && motivo.length < 5) {
    throw new Error("Escribe un motivo para el conductor (mínimo 5 caracteres).");
  }

  const adminId = await obtenerAdminIdParaAuditoria(cliente);

  if (estado === "en_revision" || estado === "reemplazado") {
    throw new Error("Ese estado no es una decisión administrativa válida.");
  }

  const { data: documento, error: errorDocumento } = await cliente
    .from("documentos_conductor")
    .select("conductor_id, tipo")
    .eq("id", documentoId)
    .single();

  if (errorDocumento) throw errorDocumento;

  const { error } = await cliente.rpc("revisar_documento_conductor_admin", {
    p_documento_id: documentoId,
    p_estado: estado,
    ...(motivo ? { p_notas: motivo } : {})
  });

  if (error) throw error;

  await registrarEvento(cliente, "validacion_documentos", "admin", adminId, {
    documento_id: documentoId,
    conductor_id: documento.conductor_id,
    tipo: documento.tipo,
    estado,
    ...(motivo ? { motivo } : {})
  });
}

/** RT-24 — aprobación final transaccional y atribuida al admin autenticado. Valida documentos obligatorios. */
export async function aprobarSolicitudConductorAdmin(cliente: Cliente, solicitudId: string, motivo?: string, aprobacionId?: string) {
  await assertAdminPermission(cliente, "conductores:validar");
  
  // Obtener la solicitud y validar documentos obligatorios
  const solicitud = await cliente.from("solicitudes_conductor").select("*").eq("id", solicitudId).single();
  if (solicitud.error) throw solicitud.error;
  if (!solicitud.data) throw new Error("Solicitud no encontrada.");
  
  if (solicitud.data.estado !== "en_revision") {
    throw new Error("La solicitud no está en estado de revisión.");
  }
  
  // Validar documentos obligatorios aprobados
  if (solicitud.data.conductor_id) {
    const { conductor, documentos } = await obtenerDetalleConductorAdmin(cliente, solicitud.data.conductor_id);
    const faltantes = DOCUMENTOS_OBLIGATORIOS_CONDUCTOR.filter(
      (tipo) => !documentos.some((d) => d.tipo === tipo && d.estado === "aprobado")
    );
    if (faltantes.length > 0) {
      throw new Error(`No se puede aprobar: faltan documentos obligatorios aprobados (${faltantes.join(", ")}).`);
    }
  }
  
  // Dual approval: si es una aprobación crítica, exigir aprobacionId
  if (aprobacionId) {
    const { error: errAprob } = await cliente.rpc("admin_validar_aprobacion", {
      p_aprobacion_id: aprobacionId,
      p_capacidad_requerida: "conductores:validar",
      p_recurso: "solicitud_conductor",
      p_recurso_id: solicitudId,
      p_accion: "aprobar"
    });
    if (errAprob) throw errAprob;
  }
  
  const { data, error } = await cliente.rpc("aprobar_solicitud_conductor_admin", {
    p_solicitud_id: solicitudId,
    ...(motivo?.trim() ? { p_motivo: motivo.trim() } : {}),
    ...(aprobacionId ? { p_aprobacion_id: aprobacionId } : {})
  });
  if (error) throw error;
  return data;
}

/** RT-24 — rechazo final con motivo obligatorio y transición registrada por servidor. */
export async function rechazarSolicitudConductorAdmin(cliente: Cliente, solicitudId: string, motivo: string) {
  await assertAdminPermission(cliente, "conductores:validar");
  const motivoLimpio = motivo.trim();
  if (motivoLimpio.length < 5) {
    throw new Error("Escribe un motivo de rechazo (mínimo 5 caracteres).");
  }
  const { error } = await cliente.rpc("rechazar_solicitud_conductor_admin", {
    p_solicitud_id: solicitudId,
    p_motivo: motivoLimpio
  });
  if (error) throw error;
}

/**
 * Fase 2 — activación de conductor. Valida en backend (no solo en UI) que los
 * 3 documentos obligatorios estén aprobados y que el conductor siga en
 * pendiente_verificacion; si no, lanza error explícito.
 */
export async function activarConductorAdmin(cliente: Cliente, conductorId: string, aprobacionId?: string) {
  await assertAdminPermission(cliente, "conductores:validar");
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { conductor, documentos } = await obtenerDetalleConductorAdmin(cliente, conductorId);

  if (conductor.estado_expediente !== "en_revision") {
    throw new Error("Este conductor ya no está en revisión inicial; no se puede activar desde aquí.");
  }

  const faltantes = DOCUMENTOS_OBLIGATORIOS_CONDUCTOR.filter(
    (tipo) => !documentos.some((d) => d.tipo === tipo && d.estado === "aprobado")
  );
  if (faltantes.length > 0) {
    throw new Error(`Aún no se puede activar: faltan documentos aprobados (${faltantes.join(", ")}).`);
  }

  // Aprobación dual requerida para activación
  if (aprobacionId) {
    const { error: errAprob } = await cliente.rpc("admin_validar_aprobacion", {
      p_aprobacion_id: aprobacionId,
      p_capacidad_requerida: "conductores:validar",
      p_recurso: "conductor",
      p_recurso_id: conductorId,
      p_accion: "activar"
    });
    if (errAprob) throw errAprob;
  } else {
    throw new Error("Esta operación requiere una aprobación dual válida (aprobacionId).");
  }

  const { error } = await cliente.rpc("aprobar_expediente_conductor_admin", {
    p_conductor_id: conductorId,
    ...(aprobacionId ? { p_aprobacion_id: aprobacionId } : {})
  });

  if (error) throw error;

  await registrarEvento(cliente, "verificacion_cuenta", "admin", adminId, {
    conductor_id: conductorId,
    accion: "activacion_conductor"
  });
}
