import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoDocumentoConductor } from "@ruum/shared/types";
import { transicionValida } from "@ruum/shared/states";
import { evidenciaCompleta } from "@ruum/shared/rules";
import { consecuenciaCancelacionConductor, consecuenciaNoPresentacion, clasificarTrasladoFallido } from "@ruum/shared/rules";
import type { FotoEvidencia } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type SolicitudConductorRow = Database["public"]["Tables"]["solicitudes_conductor"]["Row"];
type ConsentimientoUsuarioRow = Database["public"]["Tables"]["consentimientos_usuario"]["Row"];
type HistorialSolicitudRow = Database["public"]["Tables"]["historial_estados_solicitud_conductor"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];
type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type DisputaRow = Database["public"]["Tables"]["disputas"]["Row"];
type ReclamoSeguroRow = Database["public"]["Tables"]["reclamos_seguro"]["Row"];
type PagoRow = Database["public"]["Tables"]["pagos"]["Row"];
type PayoutRow = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type DatosBancariosConductorRow = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];
type NotaRow = Database["public"]["Tables"]["notas_internas_traslado"]["Row"];
type EvidenciaRow = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type EstadoConductor = Database["public"]["Enums"]["estado_conductor"];
type TipoEvidencia = Database["public"]["Enums"]["tipo_evidencia"];
type CausaFallido = Database["public"]["Enums"]["causa_fallido"];
type EstadoDisputa = Database["public"]["Enums"]["estado_disputa"];
type ResolucionDisputa = Database["public"]["Enums"]["resolucion_disputa"];
type EstadoReclamoSeguro = Database["public"]["Enums"]["estado_reclamo_seguro"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];

export interface DatosPagosAdmin {
  pagosUsuarios: PagoRow[];
  pasaportes: PasaporteRow[];
  payoutsConductores: PayoutRow[];
  datosBancariosConductores: DatosBancariosConductorRow[];
  conductores: ConductorRow[];
}

export interface DatosVehiculosAdmin {
  vehiculos: VehiculoRow[];
  usuarios: UsuarioRow[];
}

export interface DatosEmpresasAdmin {
  empresas: EmpresaRow[];
  usuarios: UsuarioRow[];
  traslados: TrasladoRow[];
}

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
  origen_lat: string;
  origen_lng: string;
  origen_referencias?: string;
  destino_direccion?: string;
  destino_ciudad?: string;
  destino_lat: string;
  destino_lng: string;
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
  estado: "procesada" | "procesada_con_errores" | "rechazada";
}

export interface CargaTrasladosMasivosAdmin {
  id: string;
  empresa_id: string;
  usuario_id: string;
  creado_por_admin_id: string | null;
  nombre_archivo: string;
  total_filas: number;
  filas_creadas: number;
  filas_error: number;
  estado: "procesada" | "procesada_con_errores" | "rechazada";
  creado_en: string;
}

export interface FilaCargaTrasladosMasivosAdmin {
  id: string;
  carga_id: string;
  numero_fila: number;
  estado: "creada" | "error";
  referencia_externa: string | null;
  datos: unknown;
  errores: string[];
  vehiculo_id: string | null;
  traslado_id: string | null;
  creado_en: string;
}

export interface DatosTrasladosMasivosAdmin {
  cargas: CargaTrasladosMasivosAdmin[];
  filas: FilaCargaTrasladosMasivosAdmin[];
}

export interface SolicitudConductorBandejaAdmin {
  solicitud: SolicitudConductorRow;
  nombre: string;
  telefono: string | null;
  curp: string | null;
  documentosVigentes: number;
  documentosRechazados: number;
  consentimientosRegistrados: number;
  ultimaDecision: HistorialSolicitudRow | null;
}

export interface HistorialSolicitudConRevisor extends HistorialSolicitudRow {
  revisor_nombre: string | null;
}

export interface DetalleSolicitudConductorAdmin {
  solicitud: SolicitudConductorRow;
  documentos: DocumentoConductorRow[];
  consentimientos: ConsentimientoUsuarioRow[];
  historial: HistorialSolicitudConRevisor[];
}

/** Admin asociado a la sesión de Supabase Auth actual, si existe (mismo patrón que obtenerUsuarioActual/obtenerConductorActual). */
export async function obtenerAdminActual(cliente: Cliente) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente.from("admins").select("*").eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function obtenerAdminIdParaAuditoria(cliente: Cliente): Promise<string> {
  const admin = await obtenerAdminActual(cliente);
  if (!admin) {
    throw new Error("No se encontró un admin autenticado para registrar auditoría.");
  }
  return admin.id;
}

const ESTADOS_TERMINALES: EstadoTraslado[] = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];

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

async function validarEvidenciaCompletaParaAdmin(cliente: Cliente, trasladoId: string, tipo: TipoEvidencia) {
  const { data, error } = await cliente
    .from("evidencia_fotos")
    .select("*")
    .eq("traslado_id", trasladoId)
    .eq("tipo", tipo);

  if (error) throw error;

  const resultado = evidenciaCompleta((data ?? []).map(aFotoEvidencia), tipo);
  if (!resultado.completa) {
    throw new Error(`No se puede cambiar a evidencia_${tipo}_completada: faltan ${resultado.angulosFaltantes.join(", ")}.`);
  }
}

async function validarPagoCompletadoParaAdmin(cliente: Cliente, trasladoId: string) {
  const { data, error } = await cliente
    .from("pagos")
    .select("id")
    .eq("traslado_id", trasladoId)
    .eq("estado", "completado")
    .limit(1);

  if (error) throw error;

  if ((data ?? []).length === 0) {
    throw new Error("No se puede cambiar a pago_completado: no existe un pago con estado completado para este viaje.");
  }
}

async function validarPrerequisitosEstatusAdmin(cliente: Cliente, trasladoId: string, nuevoEstado: EstadoTraslado) {
  if (nuevoEstado === "evidencia_inicial_completada") {
    await validarEvidenciaCompletaParaAdmin(cliente, trasladoId, "inicial");
  }
  if (nuevoEstado === "evidencia_final_completada") {
    await validarEvidenciaCompletaParaAdmin(cliente, trasladoId, "final");
  }
  if (nuevoEstado === "pago_completado") {
    await validarPagoCompletadoParaAdmin(cliente, trasladoId);
  }
}

export interface MetricasDashboard {
  viajesActivos: number;
  pendientesAsignacion: number;
  cerradosHoy: number;
  conductoresActivos: number;
  incidenciasAbiertas: number;
}

export interface MetricasRegistroConductor {
  periodo: { desde: string; hasta: string };
  abandonoPorPaso: Array<{ paso: number; total: number }>;
  erroresOtp: number;
  erroresRpc: number;
  fallosDocumentos: number;
  tiempoPromedioRegistroSegundos: number | null;
  tiempoPromedioRevisionSegundos: number | null;
  documentosRechazadosPorTipo: Array<{ tipo: string; total: number }>;
  solicitudesEnviadas: number;
}

function objetoMetrica(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

function numeroMetrica(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function numeroMetricaNullable(valor: unknown): number | null {
  return valor === null ? null : numeroMetrica(valor);
}

/** RT-27 — agregado calculado por PostgreSQL; el cliente no lee eventos crudos. */
export async function obtenerMetricasRegistroConductor(
  cliente: Cliente,
  desde: string,
  hasta: string
): Promise<MetricasRegistroConductor> {
  const { data, error } = await cliente.rpc("obtener_metricas_registro_conductor", {
    p_desde: desde,
    p_hasta: hasta
  });
  if (error) throw error;

  const raiz = objetoMetrica(data);
  const periodo = objetoMetrica(raiz.periodo);
  const abandonos = Array.isArray(raiz.abandono_por_paso) ? raiz.abandono_por_paso : [];
  const rechazados = Array.isArray(raiz.documentos_rechazados_por_tipo) ? raiz.documentos_rechazados_por_tipo : [];

  return {
    periodo: { desde: String(periodo.desde ?? desde), hasta: String(periodo.hasta ?? hasta) },
    abandonoPorPaso: abandonos.map(objetoMetrica).map((fila) => ({
      paso: numeroMetrica(fila.paso),
      total: numeroMetrica(fila.total)
    })),
    erroresOtp: numeroMetrica(raiz.errores_otp),
    erroresRpc: numeroMetrica(raiz.errores_rpc),
    fallosDocumentos: numeroMetrica(raiz.fallos_documentos),
    tiempoPromedioRegistroSegundos: numeroMetricaNullable(raiz.tiempo_promedio_registro_segundos),
    tiempoPromedioRevisionSegundos: numeroMetricaNullable(raiz.tiempo_promedio_revision_segundos),
    documentosRechazadosPorTipo: rechazados.map(objetoMetrica).map((fila) => ({
      tipo: String(fila.tipo ?? "desconocido"),
      total: numeroMetrica(fila.total)
    })),
    solicitudesEnviadas: numeroMetrica(raiz.solicitudes_enviadas)
  };
}

/**
 * PRD §17.3 — métricas del dashboard. Nota: el PRD también pide "programados
 * para hoy" y "conductores disponibles", pero ninguno de los dos es
 * calculable con el esquema actual sin inventar datos: no existe una fecha
 * de traslado programada distinta de creado_en, y "disponible" (en tiempo
 * real) es un concepto distinto de conductores.estado que todavía no tiene
 * columna propia (mismo gap documentado en app-conductor/README.md, Panel).
 * Por eso aquí se reportan "cerrados hoy" y "conductores activos" en su
 * lugar — reales, no aproximaciones de algo que no se puede medir todavía.
 */
export async function obtenerMetricasDashboard(cliente: Cliente): Promise<MetricasDashboard> {
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const [activos, pendientes, cerradosHoy, conductoresActivos, incidencias] = await Promise.all([
    cliente.from("traslados").select("id", { count: "exact", head: true }).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("estado", "pendiente_de_conductor"),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "servicio_cerrado")
      .gte("actualizado_en", hoyInicio.toISOString()),
    cliente.from("conductores").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    cliente.from("incidencias").select("id", { count: "exact", head: true }).eq("resuelta", false)
  ]);

  return {
    viajesActivos: activos.count ?? 0,
    pendientesAsignacion: pendientes.count ?? 0,
    cerradosHoy: cerradosHoy.count ?? 0,
    conductoresActivos: conductoresActivos.count ?? 0,
    incidenciasAbiertas: incidencias.count ?? 0
  };
}

/** PRD §17.4 — lista de viajes con filtro por estatus ("todos" = sin filtro). */
export async function listarViajesAdmin(cliente: Cliente, filtro: EstadoTraslado | "todos"): Promise<PasaporteRow[]> {
  let query = cliente.from("pasaporte_digital").select("*").order("creado_en", { ascending: false });
  if (filtro !== "todos") {
    query = query.eq("estado", filtro);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** PRD §17.6 — lista de conductores CONCER. */
export async function listarConductoresAdmin(cliente: Cliente): Promise<ConductorRow[]> {
  const { data, error } = await cliente.from("conductores").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function valorTextoJson(valor: unknown, llave: string): string | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const dato = (valor as Record<string, unknown>)[llave];
  return typeof dato === "string" && dato.trim() ? dato.trim() : null;
}

/** RT-23 — la bandeja se construye exclusivamente desde expedientes y sus relaciones. */
export async function listarSolicitudesConductorAdmin(cliente: Cliente): Promise<SolicitudConductorBandejaAdmin[]> {
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
      documentosVigentes: documentosActuales.length,
      documentosRechazados: documentosActuales.filter((d) => d.estado === "rechazado").length,
      consentimientosRegistrados: consentimientosPorSolicitud.get(solicitud.id)?.size ?? 0,
      ultimaDecision: ultimaDecisionPorSolicitud.get(solicitud.id) ?? null
    };
  });
}

/** PRD §17.5 — lista de usuarios. */
export async function listarUsuariosAdmin(cliente: Cliente): Promise<UsuarioRow[]> {
  const { data, error } = await cliente.from("usuarios").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Torre de Control — inventario operativo de vehículos registrados por usuarios. */
export async function listarVehiculosAdmin(cliente: Cliente): Promise<DatosVehiculosAdmin> {
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

export async function listarPagosAdmin(cliente: Cliente): Promise<DatosPagosAdmin> {
  const [pagos, pasaportes, payouts, datosBancarios, conductores] = await Promise.all([
    cliente.from("pagos").select("*").order("registrado_en", { ascending: false }),
    cliente.from("pasaporte_digital").select("*").order("creado_en", { ascending: false }),
    cliente.from("payouts_conductor").select("*").order("periodo_inicio", { ascending: false }),
    cliente.from("datos_bancarios_conductor").select("*").order("actualizado_en", { ascending: false }),
    cliente.from("conductores").select("*").order("creado_en", { ascending: false })
  ]);

  for (const resultado of [pagos, pasaportes, payouts, datosBancarios, conductores]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    pagosUsuarios: pagos.data ?? [],
    pasaportes: pasaportes.data ?? [],
    payoutsConductores: payouts.data ?? [],
    datosBancariosConductores: datosBancarios.data ?? [],
    conductores: conductores.data ?? []
  };
}

export async function listarEmpresasAdmin(cliente: Cliente): Promise<DatosEmpresasAdmin> {
  const [empresas, usuarios, traslados] = await Promise.all([
    cliente.from("empresas").select("*").order("creado_en", { ascending: false }),
    cliente
      .from("usuarios")
      .select("*")
      .not("empresa_id", "is", null)
      .in("rol", ["titular_empresa", "usuario_autorizado"])
      .order("creado_en", { ascending: false }),
    cliente.from("traslados").select("*").order("creado_en", { ascending: false })
  ]);

  for (const resultado of [empresas, usuarios, traslados]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    empresas: empresas.data ?? [],
    usuarios: usuarios.data ?? [],
    traslados: traslados.data ?? []
  };
}

export async function listarCargasTrasladosMasivosAdmin(cliente: Cliente): Promise<DatosTrasladosMasivosAdmin> {
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

export async function crearTrasladosMasivosAdmin(
  cliente: Cliente,
  parametros: {
    empresaId: string;
    usuarioId: string;
    nombreArchivo: string;
    filas: FilaTrasladoMasivoNormalizada[];
  }
): Promise<ResultadoCargaTrasladosMasivos> {
  if (!parametros.empresaId) throw new Error("Selecciona la empresa corporativa.");
  if (!parametros.usuarioId) throw new Error("Selecciona el usuario solicitante.");
  if (!parametros.nombreArchivo.trim()) throw new Error("El archivo debe tener nombre.");
  if (parametros.filas.length === 0) throw new Error("El archivo no contiene filas válidas para enviar.");
  if (parametros.filas.length > 500) throw new Error("El lote excede el máximo de 500 filas por carga.");

  const rpc = cliente.rpc as unknown as (
    fn: "admin_crea_traslados_masivos",
    args: {
      p_empresa_id: string;
      p_usuario_id: string;
      p_nombre_archivo: string;
      p_filas: FilaTrasladoMasivoNormalizada[];
    }
  ) => Promise<{ data: ResultadoCargaTrasladosMasivos | null; error: Error | null }>;

  const { data, error } = await rpc("admin_crea_traslados_masivos", {
    p_empresa_id: parametros.empresaId,
    p_usuario_id: parametros.usuarioId,
    p_nombre_archivo: parametros.nombreArchivo,
    p_filas: parametros.filas
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo confirmar la carga masiva.");
  return data;
}

export async function validarDocumentoUsuario(
  cliente: Cliente,
  usuarioId: string,
  estadoVerificacion: EstadoVerificacion,
  motivo?: string
) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente
    .from("usuarios")
    .update({ estado_verificacion: estadoVerificacion })
    .eq("id", usuarioId);

  if (error) throw error;

  await registrarEvento(cliente, "validacion_documentos", "admin", adminId, {
    usuario_id: usuarioId,
    estado_verificacion: estadoVerificacion,
    ...(motivo?.trim() ? { motivo: motivo.trim() } : {})
  });
}

export async function validarDocumentoConductor(cliente: Cliente, conductorId: string, aprobado: boolean) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente
    .from("conductores")
    .update({ documentos_vigentes: aprobado })
    .eq("id", conductorId);

  if (error) throw error;

  await registrarEvento(cliente, "validacion_documentos", "admin", adminId, {
    conductor_id: conductorId,
    documentos_vigentes: aprobado
  });
}

type DocumentoConductorRow = Database["public"]["Tables"]["documentos_conductor"]["Row"];

/** Estados posibles de un documento individual del expediente del conductor. */
export type { EstadoDocumentoConductor } from "@ruum/shared/types";

const DOCUMENTOS_OBLIGATORIOS_CONDUCTOR = ["licencia_frente", "licencia_reverso", "identificacion_oficial"] as const;

/** Fase 2 — expediente completo (conductor + documentos) para la vista de detalle del panel admin. */
export async function obtenerDetalleConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<{ conductor: ConductorRow; documentos: DocumentoConductorRow[] }> {
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

/** RT-23 — expediente de revisión con documentos actuales, consentimientos e historial. */
export async function obtenerDetalleSolicitudConductorAdmin(
  cliente: Cliente,
  solicitudId: string
): Promise<DetalleSolicitudConductorAdmin> {
  const solicitud = await cliente.from("solicitudes_conductor").select("*").eq("id", solicitudId).single();
  if (solicitud.error) throw solicitud.error;

  const filtroDocumentos = solicitud.data.conductor_id
    ? `solicitud_id.eq.${solicitudId},conductor_id.eq.${solicitud.data.conductor_id}`
    : `solicitud_id.eq.${solicitudId}`;
  const [documentos, consentimientos, historial, admins] = await Promise.all([
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
    cliente.from("admins").select("id,nombre")
  ]);

  for (const resultado of [documentos, consentimientos, historial, admins]) {
    if (resultado.error) throw resultado.error;
  }
  const nombreAdmin = new Map((admins.data ?? []).map((admin) => [admin.id, admin.nombre]));

  return {
    solicitud: solicitud.data,
    documentos: documentos.data ?? [],
    consentimientos: consentimientos.data ?? [],
    historial: (historial.data ?? []).map((evento) => ({
      ...evento,
      revisor_nombre: evento.revisado_por ? nombreAdmin.get(evento.revisado_por) ?? "Administrador" : null
    }))
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

/** RT-24 — aprobación final transaccional y atribuida al admin autenticado. */
export async function aprobarSolicitudConductorAdmin(cliente: Cliente, solicitudId: string, motivo?: string) {
  const { data, error } = await cliente.rpc("aprobar_solicitud_conductor_admin", {
    p_solicitud_id: solicitudId,
    ...(motivo?.trim() ? { p_motivo: motivo.trim() } : {})
  });
  if (error) throw error;
  return data;
}

/** RT-24 — rechazo final con motivo obligatorio y transición registrada por servidor. */
export async function rechazarSolicitudConductorAdmin(cliente: Cliente, solicitudId: string, motivo: string) {
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
export async function activarConductorAdmin(cliente: Cliente, conductorId: string) {
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

  const { error } = await cliente.rpc("aprobar_expediente_conductor_admin", {
    p_conductor_id: conductorId
  });

  if (error) throw error;

  await registrarEvento(cliente, "verificacion_cuenta", "admin", adminId, {
    conductor_id: conductorId,
    accion: "activacion_conductor"
  });
}

export async function validarDocumentoEmpresa(
  cliente: Cliente,
  empresaId: string,
  estadoVerificacion: EstadoVerificacion,
  condicionesPago: string
) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente
    .from("empresas")
    .update({
      estado_verificacion: estadoVerificacion,
      condiciones_pago: condicionesPago.trim() || null
    })
    .eq("id", empresaId);

  if (error) throw error;

  await registrarEvento(cliente, "validacion_documentos", "admin", adminId, {
    empresa_id: empresaId,
    estado_verificacion: estadoVerificacion,
    condiciones_pago: condicionesPago.trim() || null
  });
}

/** PRD §17.8 — lista de incidencias. */
export async function listarIncidenciasAdmin(cliente: Cliente): Promise<IncidenciaRow[]> {
  const { data, error } = await cliente.from("incidencias").select("*").order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarDisputasAdmin(cliente: Cliente): Promise<DisputaRow[]> {
  const { data, error } = await cliente.from("disputas").select("*").order("abierta_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function resolverDisputaAdmin(
  cliente: Cliente,
  disputaId: string,
  estado: EstadoDisputa,
  resolucion: ResolucionDisputa | null,
  detalle: string
) {
  const esEstadoResuelto = estado === "resuelta" || estado === "resuelta_senior";
  if (esEstadoResuelto && !resolucion) {
    throw new Error("Selecciona una resolución para cerrar la disputa.");
  }

  const { error } = await cliente.rpc("admin_resuelve_disputa", {
    p_disputa_id: disputaId,
    p_estado: estado,
    p_resolucion: (esEstadoResuelto ? resolucion : null) as never,
    p_detalle: detalle
  });

  if (error) throw error;
}

export async function listarReclamosSeguroAdmin(cliente: Cliente): Promise<ReclamoSeguroRow[]> {
  const { data, error } = await cliente.from("reclamos_seguro").select("*").order("abierto_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function actualizarReclamoSeguroAdmin(
  cliente: Cliente,
  reclamoId: string,
  estado: EstadoReclamoSeguro,
  responsablePago: "aplicacion" | "conductor" | null,
  notasAdmin: string
) {
  if (estado === "resuelto" && !responsablePago) {
    throw new Error("Selecciona responsable de pago antes de resolver el reclamo.");
  }

  const { error } = await cliente.rpc("admin_actualiza_reclamo_seguro", {
    p_reclamo_id: reclamoId,
    p_estado: estado,
    p_responsable_pago: responsablePago as never,
    p_notas_admin: notasAdmin
  });

  if (error) throw error;
}

// PRD §6 — único camino real hacia "conductor_asignado" (sin atajos, ver
// TRANSICIONES). Antes de la decisión de producto del 2026-06-29, asignar
// un conductor en cualquier estado anterior a pendiente_de_conductor dejaba
// el viaje en un limbo: conductor_id quedaba asignado, pero el estado nunca
// avanzaba, así que el conductor no veía ninguna acción disponible en su
// pantalla (encontrado probando con un conductor y usuario reales).
const CADENA_HASTA_CONDUCTOR_ASIGNADO: EstadoTraslado[] = [
  "solicitud_creada",
  "documentacion_pendiente",
  "documentacion_en_revision",
  "documentacion_validada",
  "cotizacion_generada",
  "servicio_confirmado",
  "pendiente_de_conductor",
  "conductor_asignado"
];

/**
 * Decisión de producto (2026-06-29): al asignar un conductor desde
 * panel-admin, el viaje SIEMPRE avanza hasta "conductor_asignado" — sin
 * importar en qué paso intermedio estuviera (documentación, cotización,
 * etc.). Recorre la cadena real un salto a la vez (cada uno válido contra
 * el mismo trigger de Postgres que ya protege la tabla), en vez de saltar
 * directo — así nunca se viola la máquina de estados real.
 *
 * Si el viaje ya pasó "conductor_asignado" (ya está en tránsito o más
 * adelante), o está en una rama terminal (cancelado/fallido), se rechaza
 * explícitamente: reasignar conductor a media ruta es un caso distinto,
 * fuera de alcance de este fix.
 */
export async function asignarConductorAdmin(
  cliente: Cliente,
  trasladoId: string,
  conductorId: string,
  estadoActual: EstadoTraslado
) {
  if (estadoActual !== "conductor_asignado" && !CADENA_HASTA_CONDUCTOR_ASIGNADO.includes(estadoActual)) {
    throw new Error(
      `No se puede asignar conductor desde el estado "${estadoActual}" — ese estado no forma parte del camino hacia conductor_asignado (¿el viaje ya está en tránsito, cancelado, o fallido?).`
    );
  }

  const { error } = await cliente.rpc("admin_asigna_conductor", {
    p_traslado_id: trasladoId,
    p_conductor_id: conductorId
  });
  if (error) throw error;
}

/**
 * PRD §17.4 — "cambiar estatus". Valida contra TRANSICIONES (mismo mapa que
 * el trigger de Postgres en 0005) antes de intentarlo, para dar un mensaje
 * claro en vez de depender solo del error crudo de la base. También valida
 * los prerequisitos de contenido real (evidencia completa, pago completado)
 * antes de aplicar el cambio — cierra el hueco donde este selector genérico
 * podía marcar evidencia_*_completada o pago_completado sin que existiera
 * evidencia o pago real detrás (mismo criterio que ya aplicaban
 * evidencia.ts::confirmarEvidenciaCompleta y el webhook de Stripe).
 */
export async function cambiarEstatusAdmin(
  cliente: Cliente,
  trasladoId: string,
  estadoActual: EstadoTraslado,
  nuevoEstado: EstadoTraslado
) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);

  if (!transicionValida(estadoActual, nuevoEstado)) {
    throw new Error(`Transición no permitida: ${estadoActual} -> ${nuevoEstado}`);
  }

  await validarPrerequisitosEstatusAdmin(cliente, trasladoId, nuevoEstado);

  const { error } = await cliente.from("traslados").update({ estado: nuevoEstado }).eq("id", trasladoId).eq("estado", estadoActual);
  if (error) throw error;

  await registrarEvento(cliente, "modificacion_traslado_activo", "admin", adminId, {
    traslado_id: trasladoId,
    estado_anterior: estadoActual,
    estado_nuevo: nuevoEstado
  });
}

/** PRD §17.4, bloque 7 — notas internas, visibles solo para el equipo de operación. */
export async function obtenerNotasInternas(cliente: Cliente, trasladoId: string): Promise<NotaRow[]> {
  const { data, error } = await cliente
    .from("notas_internas_traslado")
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function agregarNotaInterna(cliente: Cliente, trasladoId: string, adminId: string, contenido: string) {
  const { error } = await cliente.from("notas_internas_traslado").insert({ traslado_id: trasladoId, admin_id: adminId, contenido });
  if (error) throw error;
}

/**
 * PRD §4.6 — "El precio puede ser dinámico." Ni el PRD ni el resto del
 * código definían quién fija `precio_final` ni cuándo — la columna existía
 * desde la migración inicial (0005) y panel-admin ya la mostraba, pero
 * siempre en "—" porque nada la escribía. Decisión de UX consistente con
 * PRD §3 ("el conductor no puede modificar precio"): es un ajuste de Admin,
 * sin atarlo a un estado específico (puede afinarse en cualquier momento
 * antes del cierre, ej. al revisar evidencia o resolver una incidencia con
 * costo). `crear-payment-intent` ya usa `precio_final` en cuanto existe
 * (en vez de `precio_cotizado`) para el cobro al cierre.
 */
export async function ajustarPrecioFinalAdmin(cliente: Cliente, trasladoId: string, precioFinal: number) {
  if (!Number.isFinite(precioFinal) || precioFinal < 0) {
    throw new Error("La tarifa final debe ser un número válido mayor o igual a 0.");
  }

  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente.from("traslados").update({ precio_final: precioFinal }).eq("id", trasladoId);
  if (error) throw error;

  await registrarEvento(cliente, "modificacion_traslado_activo", "admin", adminId, {
    traslado_id: trasladoId,
    precio_final: precioFinal
  });
}

export async function emitirCotizacionAdmin(cliente: Cliente, trasladoId: string, precio: number) {
  if (!Number.isFinite(precio) || precio <= 0) throw new Error("La tarifa normativa debe ser mayor a cero.");
  const { error } = await cliente.rpc("admin_emite_cotizacion", { p_traslado_id: trasladoId, p_precio: precio });
  if (error) throw error;
}

export async function aplicarTarifaNormativaAdmin(cliente: Cliente, trasladoId: string): Promise<number> {
  const rpc = cliente.rpc as unknown as (
    fn: "admin_aplica_tarifa_normativa",
    args: { p_traslado_id: string }
  ) => Promise<{ data: number | null; error: Error | null }>;
  const { data, error } = await rpc("admin_aplica_tarifa_normativa", { p_traslado_id: trasladoId });
  if (error) throw error;
  if (data == null) throw new Error("No se pudo confirmar la tarifa normativa aplicada.");
  return data;
}

/** PRD §17.6 — "suspender/reactivar" conductor. */
export async function cambiarEstadoConductorAdmin(cliente: Cliente, conductorId: string, nuevoEstado: EstadoConductor) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente.from("conductores").update({ estado: nuevoEstado }).eq("id", conductorId);
  if (error) throw error;

  await registrarEvento(cliente, "suspension_conductor", "admin", adminId, {
    conductor_id: conductorId,
    estado_nuevo: nuevoEstado
  });
}

export async function registrarNoPresentacionConductor(cliente: Cliente, conductorId: string) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { data: conductor, error: errorConductor } = await cliente
    .from("conductores")
    .select("id, no_presentaciones_6m")
    .eq("id", conductorId)
    .maybeSingle();

  if (errorConductor) throw errorConductor;
  if (!conductor) throw new Error("No se encontró el conductor.");

  const ocurrencias = conductor.no_presentaciones_6m + 1;
  const consecuencia = consecuenciaNoPresentacion(ocurrencias);
  const { error } = await cliente
    .from("conductores")
    .update({ no_presentaciones_6m: ocurrencias, estado: consecuencia.nuevoEstado })
    .eq("id", conductorId);

  if (error) throw error;

  await registrarEvento(cliente, "suspension_conductor", "admin", adminId, {
    conductor_id: conductorId,
    tipo: "no_presentacion",
    ocurrencias_6m: ocurrencias,
    estado_nuevo: consecuencia.nuevoEstado,
    dias_suspension: consecuencia.diasSuspension ?? null,
    mensaje: consecuencia.mensaje
  });

  return consecuencia;
}

export async function registrarCancelacionConductor(cliente: Cliente, conductorId: string, conJustificacion: boolean) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);

  if (conJustificacion) {
    await registrarEvento(cliente, "suspension_conductor", "admin", adminId, {
      conductor_id: conductorId,
      tipo: "cancelacion_conductor",
      con_justificacion: true,
      mensaje: "Cancelación de conductor registrada con justificación; no aplica consecuencia."
    });
    return null;
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
  const { error } = await cliente
    .from("conductores")
    .update({ cancelaciones_sin_justificacion_count: cancelaciones, estado: consecuencia.nuevoEstado })
    .eq("id", conductorId);

  if (error) throw error;

  await registrarEvento(cliente, "suspension_conductor", "admin", adminId, {
    conductor_id: conductorId,
    tipo: "cancelacion_conductor",
    con_justificacion: false,
    cancelaciones_sin_justificacion: cancelaciones,
    estado_nuevo: consecuencia.nuevoEstado,
    dias_suspension: consecuencia.diasSuspension ?? null,
    mensaje: consecuencia.mensaje
  });

  return consecuencia;
}

export async function marcarTrasladoFallido(cliente: Cliente, trasladoId: string, causa: CausaFallido) {
  const resultado = clasificarTrasladoFallido(causa);

  const { error } = await cliente.rpc("admin_marca_traslado_fallido", {
    p_traslado_id: trasladoId,
    p_causa: causa,
    p_cargo_aplica_cliente: resultado.cargo_aplica_cliente,
    p_requiere_reagendamiento: resultado.requiere_reagendamiento,
    p_porcentaje_descuento_segundo_intento: (resultado.porcentaje_descuento_segundo_intento ?? null) as never,
    p_mensaje: resultado.mensaje
  });

  if (error) throw error;

  return resultado;
}

// ─── Mapa operativo ──────────────────────────────────────────────────────────

export interface TrasladoMapa {
  traslado_id: string;
  estado: EstadoTraslado;
  conductor_nombre: string | null;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  tiene_incidencia_abierta: boolean;
  origen_lat: number | null;
  origen_lng: number | null;
  origen_ciudad: string;
  destino_lat: number | null;
  destino_lng: number | null;
  destino_ciudad: string;
  actualizado_en: string;
}

type TrasladoActivoMapaRow = {
  id: string;
  estado: EstadoTraslado;
  tiene_incidencia_abierta: boolean;
  actualizado_en: string;
  origen_lat: number | null;
  origen_lng: number | null;
  origen_ciudad: string;
  destino_lat: number | null;
  destino_lng: number | null;
  destino_ciudad: string;
  conductores: { nombre: string } | null;
  vehiculos: { marca: string; modelo: string } | null;
};

const ESTADOS_ACTIVOS: EstadoTraslado[] = [
  "conductor_asignado",
  "conductor_en_camino_al_origen",
  "conductor_en_punto_de_recoleccion",
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_inicial_completada",
  "vehiculo_recibido",
  "traslado_en_curso",
  "incidencia_reportada",
  "llegada_a_destino",
  "evidencia_final_en_proceso",
  "evidencia_final_completada",
  "entrega_confirmada",
  "pago_pendiente",
  "pago_completado"
];

/**
 * PRD §10.3 — Mapa operativo: traslados activos con coordenadas de origen y
 * destino para pintarlos en el mapa de la Torre de Control.
 * La vista pasaporte_digital no incluye lat/lng (son datos operativos del
 * traslado, no del pasaporte); se consultan directamente de la tabla traslados
 * unida con conductores y vehículos.
 */
export async function listarTrasladosActivosMapa(cliente: Cliente): Promise<TrasladoMapa[]> {
  const { data, error } = await cliente
    .from("traslados")
    .select(
      `id, estado, tiene_incidencia_abierta, actualizado_en,
       origen_lat, origen_lng, origen_ciudad,
       destino_lat, destino_lng, destino_ciudad,
       conductores(nombre),
       vehiculos(marca, modelo)`
    )
    .in("estado", ESTADOS_ACTIVOS)
    .order("actualizado_en", { ascending: false });

  if (error) throw error;

  const traslados = (data ?? []) as unknown as TrasladoActivoMapaRow[];

  return traslados.map((t) => ({
    traslado_id: t.id,
    estado: t.estado,
    conductor_nombre: (t.conductores as { nombre: string } | null)?.nombre ?? null,
    vehiculo_marca: (t.vehiculos as { marca: string; modelo: string } | null)?.marca ?? null,
    vehiculo_modelo: (t.vehiculos as { marca: string; modelo: string } | null)?.modelo ?? null,
    tiene_incidencia_abierta: t.tiene_incidencia_abierta,
    origen_lat: t.origen_lat,
    origen_lng: t.origen_lng,
    origen_ciudad: t.origen_ciudad,
    destino_lat: t.destino_lat,
    destino_lng: t.destino_lng,
    destino_ciudad: t.destino_ciudad,
    actualizado_en: t.actualizado_en
  }));
}

// ─── Alertas SLA ─────────────────────────────────────────────────────────────

export type TipoSLA =
  | "cuenta_nueva_usuario"
  | "documentos_usuario"
  | "conductor_primera_vez"
  | "documentos_conductor";

export interface AlertaSLA {
  id: string;
  tipo: TipoSLA;
  nombre: string;
  creado_en: string;
  horas_transcurridas: number;
  horas_limite: number;
  porcentaje_consumido: number;
  requiere_alerta: boolean;     // ≥80% del SLA
  vencido: boolean;             // >100% del SLA
}

/** Calcula horas hábiles transcurridas desde una fecha ISO.
 *  Aproximación pragmática: L-V 09:00-18:00 hora local (9h/día).
 *  Suficiente para el propósito de alertas de SLA operativo. */
function horasHabilesDesde(fechaIso: string): number {
  const inicio = new Date(fechaIso);
  const ahora = new Date();
  let horas = 0;
  const cursor = new Date(inicio);

  while (cursor < ahora) {
    const diaSemana = cursor.getDay(); // 0=dom, 6=sab
    const horaActual = cursor.getHours();
    if (diaSemana >= 1 && diaSemana <= 5 && horaActual >= 9 && horaActual < 18) {
      horas += 1;
    }
    cursor.setHours(cursor.getHours() + 1);
  }
  return horas;
}

/**
 * PRD §4.1 — SLAs de verificación. Admin recibe alerta cuando un usuario o
 * conductor supera el 80% del SLA sin resolución. Esta función devuelve todos
 * los pendientes con su porcentaje de consumo para mostrarlos como panel de
 * alertas en Torre de Control.
 */
export async function listarAlertasSLA(cliente: Cliente): Promise<AlertaSLA[]> {
  const LIMITE: Record<TipoSLA, number> = {
    cuenta_nueva_usuario: 2,
    documentos_usuario: 4,
    conductor_primera_vez: 24,
    documentos_conductor: 24
  };

  const [usuarios, conductores] = await Promise.all([
    cliente
      .from("usuarios")
      .select("id, nombre, estado_verificacion, creado_en")
      .in("estado_verificacion", ["pendiente", "en_revision"])
      .order("creado_en", { ascending: true }),
    cliente
      .from("conductores")
      .select("id, nombre, estado, documentos_vigentes, creado_en, traslados_completados")
      .eq("estado", "pendiente_verificacion")
      .order("creado_en", { ascending: true })
  ]);

  if (usuarios.error) throw usuarios.error;
  if (conductores.error) throw conductores.error;

  const alertas: AlertaSLA[] = [];

  for (const u of usuarios.data ?? []) {
    const tipo: TipoSLA =
      u.estado_verificacion === "pendiente" ? "cuenta_nueva_usuario" : "documentos_usuario";
    const limite = LIMITE[tipo];
    const horas = horasHabilesDesde(u.creado_en);
    const porcentaje = Math.min(Math.round((horas / limite) * 100), 999);
    alertas.push({
      id: u.id,
      tipo,
      nombre: u.nombre ?? "Usuario sin nombre",
      creado_en: u.creado_en,
      horas_transcurridas: horas,
      horas_limite: limite,
      porcentaje_consumido: porcentaje,
      requiere_alerta: porcentaje >= 80 && horas <= limite,
      vencido: horas > limite
    });
  }

  for (const c of conductores.data ?? []) {
    const tipo: TipoSLA =
      (c.traslados_completados ?? 0) === 0 ? "conductor_primera_vez" : "documentos_conductor";
    const limite = LIMITE[tipo];
    const horas = horasHabilesDesde(c.creado_en);
    const porcentaje = Math.min(Math.round((horas / limite) * 100), 999);
    alertas.push({
      id: c.id,
      tipo,
      nombre: c.nombre ?? "Conductor sin nombre",
      creado_en: c.creado_en,
      horas_transcurridas: horas,
      horas_limite: limite,
      porcentaje_consumido: porcentaje,
      requiere_alerta: porcentaje >= 80 && horas <= limite,
      vencido: horas > limite
    });
  }

  // Primero vencidos, luego por porcentaje consumido descendente
  return alertas.sort((a, b) => {
    if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
    return b.porcentaje_consumido - a.porcentaje_consumido;
  });
}
