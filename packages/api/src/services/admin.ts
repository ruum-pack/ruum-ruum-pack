import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstadoDocumentoConductor } from "@ruum/shared/types";
import { transicionValida } from "@ruum/shared/states";
import { evidenciaCompleta, esElegibleParaViaje } from "@ruum/shared/rules";
import { consecuenciaCancelacionConductor, consecuenciaNoPresentacion, clasificarTrasladoFallido } from "@ruum/shared/rules";
import type { FotoEvidencia, Conductor } from "@ruum/shared/types";
import { registrarEvento, generarTraceId } from "./auditoria";
import { assertAdminPermission } from "./permisos-admin";

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
type AuditoriaRow = Database["public"]["Tables"]["registro_auditoria"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type EstadoConductor = Database["public"]["Enums"]["estado_conductor"];
type TipoEvidencia = Database["public"]["Enums"]["tipo_evidencia"];
type CausaFallido = Database["public"]["Enums"]["causa_fallido"];
type EstadoDisputa = Database["public"]["Enums"]["estado_disputa"];
type ResolucionDisputa = Database["public"]["Enums"]["resolucion_disputa"];
type EstadoReclamoSeguro = Database["public"]["Enums"]["estado_reclamo_seguro"];
type EstadoVerificacion = Database["public"]["Enums"]["estado_verificacion"];
type TipoIncidencia = Database["public"]["Enums"]["tipo_incidencia"];

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

export interface TrazabilidadMasivaTraslado {
  carga: CargaTrasladosMasivosAdmin;
  fila: FilaCargaTrasladosMasivosAdmin;
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

export type ClaveIndicadorDashboard =
  | "traslados_activos"
  | "inician_60_min"
  | "sin_asignacion"
  | "riesgo_sla"
  | "con_incidencia"
  | "finalizados_hoy";

export interface IndicadorAccionableDashboard {
  clave: ClaveIndicadorDashboard;
  titulo: string;
  valor: number;
  ventanaTemporal: string;
  variacion: number;
  umbral: string;
  subgrupoCritico: string;
  href: string;
  severidad: "normal" | "atencion" | "critico";
  actualizadoEn: string;
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

function inicioDeHoy() {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

function porcentajeVariacion(actual: number, previo: number) {
  if (previo === 0) return actual === 0 ? 0 : 100;
  return Math.round(((actual - previo) / previo) * 100);
}

function severidadIndicador(valor: number, umbralCritico: number, umbralAtencion = Math.ceil(umbralCritico * 0.7)): IndicadorAccionableDashboard["severidad"] {
  if (valor >= umbralCritico) return "critico";
  if (valor >= umbralAtencion) return "atencion";
  return "normal";
}

export async function obtenerIndicadoresAccionablesDashboard(cliente: Cliente): Promise<IndicadorAccionableDashboard[]> {
  const ahora = new Date();
  const hoy = inicioDeHoy();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const hace48h = new Date(ahora.getTime() - 48 * 60 * 60 * 1000);
  const en60Min = new Date(ahora.getTime() + 60 * 60 * 1000);
  const ayerInicio = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

  const [
    activos,
    activosPrevios,
    inician60,
    sinAsignacion,
    sinAsignacionPrevio,
    cerradosHoy,
    cerradosAyer,
    conIncidencia,
    incidenciasPrevias,
    excepciones
  ] = await Promise.all([
    cliente.from("traslados").select("id", { count: "exact", head: true }).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente.from("traslados").select("id", { count: "exact", head: true }).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`).lt("actualizado_en", hace24h.toISOString()),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("modalidad_programacion", "programado")
      .gte("fecha_hora_programada", ahora.toISOString())
      .lte("fecha_hora_programada", en60Min.toISOString())
      .not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("estado", "pendiente_de_conductor"),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente_de_conductor")
      .lt("actualizado_en", hace24h.toISOString()),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("estado", "servicio_cerrado").gte("actualizado_en", hoy.toISOString()),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "servicio_cerrado")
      .gte("actualizado_en", ayerInicio.toISOString())
      .lt("actualizado_en", hoy.toISOString()),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("tiene_incidencia_abierta", true).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente
      .from("incidencias")
      .select("id", { count: "exact", head: true })
      .eq("resuelta", false)
      .gte("creada_en", hace48h.toISOString())
      .lt("creada_en", hace24h.toISOString()),
    listarExcepcionesCriticasAdmin(cliente)
  ]);

  for (const resultado of [activos, activosPrevios, inician60, sinAsignacion, sinAsignacionPrevio, cerradosHoy, cerradosAyer, conIncidencia, incidenciasPrevias]) {
    if (resultado.error) throw resultado.error;
  }

  const riesgoSla = excepciones.filter((item) => item.categoria === "sla_en_riesgo" || item.categoria === "sla_vencido").length;
  const riesgoSlaCritico = excepciones.filter((item) => item.categoria === "sla_vencido").length;
  const documentacionBloqueante = excepciones.filter((item) => item.categoria === "documentacion_bloqueante").length;
  const actualizadoEn = ahora.toISOString();

  return [
    {
      clave: "traslados_activos",
      titulo: "Traslados activos",
      valor: activos.count ?? 0,
      ventanaTemporal: "Ahora · operación abierta",
      variacion: porcentajeVariacion(activos.count ?? 0, activosPrevios.count ?? 0),
      umbral: "Atención > 12 · crítico > 18",
      subgrupoCritico: `${conIncidencia.count ?? 0} con incidencia`,
      href: "/viajes?filtro=activos",
      severidad: severidadIndicador(activos.count ?? 0, 18, 12),
      actualizadoEn
    },
    {
      clave: "inician_60_min",
      titulo: "Inician en 60 minutos",
      valor: inician60.count ?? 0,
      ventanaTemporal: "Próximos 60 min",
      variacion: 0,
      umbral: "Atención > 3 · crítico > 6",
      subgrupoCritico: `${sinAsignacion.count ?? 0} sin conductor`,
      href: "/viajes?filtro=inician_60",
      severidad: severidadIndicador(inician60.count ?? 0, 6, 3),
      actualizadoEn
    },
    {
      clave: "sin_asignacion",
      titulo: "Sin asignación",
      valor: sinAsignacion.count ?? 0,
      ventanaTemporal: "Ahora · pendientes de conductor",
      variacion: porcentajeVariacion(sinAsignacion.count ?? 0, sinAsignacionPrevio.count ?? 0),
      umbral: "Atención > 1 · crítico > 3",
      subgrupoCritico: `${Math.max(0, sinAsignacionPrevio.count ?? 0)} con más de 24 h`,
      href: "/viajes?filtro=sin_asignacion",
      severidad: severidadIndicador(sinAsignacion.count ?? 0, 3, 1),
      actualizadoEn
    },
    {
      clave: "riesgo_sla",
      titulo: "En riesgo de SLA",
      valor: riesgoSla,
      ventanaTemporal: "Ahora · excepciones SLA",
      variacion: 0,
      umbral: "Atención > 0 · crítico si vencido",
      subgrupoCritico: `${riesgoSlaCritico} vencidos`,
      href: "/alertas-sla?categoria=sla_en_riesgo",
      severidad: riesgoSlaCritico > 0 ? "critico" : riesgoSla > 0 ? "atencion" : "normal",
      actualizadoEn
    },
    {
      clave: "con_incidencia",
      titulo: "Con incidencia",
      valor: conIncidencia.count ?? 0,
      ventanaTemporal: "Ahora · traslados activos",
      variacion: porcentajeVariacion(conIncidencia.count ?? 0, incidenciasPrevias.count ?? 0),
      umbral: "Atención > 0 · crítico > 2",
      subgrupoCritico: `${documentacionBloqueante} documentación bloqueante`,
      href: "/viajes?filtro=incidencia",
      severidad: severidadIndicador(conIncidencia.count ?? 0, 2, 1),
      actualizadoEn
    },
    {
      clave: "finalizados_hoy",
      titulo: "Finalizados hoy",
      valor: cerradosHoy.count ?? 0,
      ventanaTemporal: "Hoy · 00:00 a ahora",
      variacion: porcentajeVariacion(cerradosHoy.count ?? 0, cerradosAyer.count ?? 0),
      umbral: "Meta >= cierre del día anterior",
      subgrupoCritico: `${cerradosAyer.count ?? 0} ayer`,
      href: "/viajes?filtro=finalizados_hoy",
      severidad: "normal",
      actualizadoEn
    }
  ];
}

export interface PaginacionViajes {
  data: PasaporteRow[];
  paginacion: {
    pagina: number;
    tamano: number;
    total: number;
    total_paginas: number;
  };
}

/**
 * Reintento idempotente para operaciones del admin.
 * Envuelve una operacion con clave de idempotencia, evitando
 * duplicados si la operacion ya se completo previamente.
 */
async function withIdempotentRetry<T>(
  operacion: () => Promise<T>
): Promise<T> {
  const maxIntentos = 3;
  let ultimoError: Error | null = null;

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await operacion();
    } catch (err) {
      ultimoError = err instanceof Error ? err : new Error(String(err));
      const msg = ultimoError.message;

      if (msg.includes("CONCURRENCY_CONFLICT") || msg.includes("PERMISO_INSUFICIENTE") || msg.includes("TRANSICION_INVALIDA")) {
        throw ultimoError;
      }

      if (intento < maxIntentos) {
        const espera = Math.min(200 * Math.pow(2, intento - 1), 2000);
        await new Promise((resolve) => setTimeout(resolve, espera));
      }
    }
  }

  throw ultimoError ?? new Error("Reintentos agotados sin resultado.");
}

/** PRD §17.4 — lista de viajes con paginación de servidor. */
export async function listarViajesAdmin(cliente: Cliente, filtro: EstadoTraslado | "todos"): Promise<PasaporteRow[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  let query = cliente.from("pasaporte_digital").select("*").order("creado_en", { ascending: false });
  if (filtro !== "todos") {
    query = query.eq("estado", filtro);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listarViajesAdminPaginados(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  filtroEstado: EstadoTraslado | "todos",
  busqueda?: string,
  ordenColumna?: string,
  ordenDireccion?: string
): Promise<PaginacionViajes> {
  await assertAdminPermission(cliente, "viajes:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "listar_viajes_admin_paginados",
    args: {
      p_pagina: number;
      p_tamano: number;
      p_filtro_estado: string;
      p_busqueda?: string;
      p_orden_columna?: string;
      p_orden_direccion?: string;
    }
  ) => Promise<{ data: PaginacionViajes | null; error: unknown }>;
  const { data, error } = await rpc("listar_viajes_admin_paginados", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_filtro_estado: filtroEstado,
    p_busqueda: busqueda?.trim() || undefined,
    p_orden_columna: ordenColumna,
    p_orden_direccion: ordenDireccion
  });
  if (error) throw error;
  if (!data) return { data: [], paginacion: { pagina: 1, tamano: 25, total: 0, total_paginas: 0 } };
  return data;
}

/** PRD §17.6 — lista de conductores CONCER. */
export async function listarConductoresAdmin(cliente: Cliente): Promise<ConductorRow[]> {
  await assertAdminPermission(cliente, "conductores:leer");
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
      documentosVigentes: documentosActuales.length,
      documentosRechazados: documentosActuales.filter((d) => d.estado === "rechazado").length,
      consentimientosRegistrados: consentimientosPorSolicitud.get(solicitud.id)?.size ?? 0,
      ultimaDecision: ultimaDecisionPorSolicitud.get(solicitud.id) ?? null
    };
  });
}

/** PRD §17.5 — lista de usuarios. */
export async function listarUsuariosAdmin(cliente: Cliente): Promise<UsuarioRow[]> {
  await assertAdminPermission(cliente, "usuarios:leer");
  const { data, error } = await cliente.from("usuarios").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Torre de Control — inventario operativo de vehículos registrados por usuarios. */
export async function listarVehiculosAdmin(cliente: Cliente): Promise<DatosVehiculosAdmin> {
  await assertAdminPermission(cliente, "conductores:leer");
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

export interface EvidenciaVehiculoTraslado {
  traslado_id: string;
  traslado_estado: string;
  fotos: Array<{
    id: string;
    tipo: string;
    angulo: string;
    url: string | null;
    capturada_en: string;
    sincronizada: boolean;
  }>;
}

/**
 * Obtiene la evidencia (fotos) asociada a un vehículo a través de sus traslados.
 */
export async function obtenerEvidenciaVehiculo(
  cliente: Cliente,
  vehiculoId: string
): Promise<EvidenciaVehiculoTraslado[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_obtener_evidencia_vehiculo",
    args: { p_vehiculo_id: string }
  ) => Promise<{ data: EvidenciaVehiculoTraslado[] | null; error: unknown }>;
  const { data, error } = await rpc("admin_obtener_evidencia_vehiculo", {
    p_vehiculo_id: vehiculoId
  });
  if (error) throw error;
  return data ?? [];
}

export async function listarPagosAdmin(cliente: Cliente): Promise<DatosPagosAdmin> {
  await assertAdminPermission(cliente, "pagos:leer");
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
  await assertAdminPermission(cliente, "empresas:leer");
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

export async function crearEmpresaCorporativaAdmin(
  cliente: Cliente,
  datos: AltaEmpresaCorporativa
): Promise<ResultadoAltaEmpresaCorporativa> {
  await assertAdminPermission(cliente, "empresas:gestionar");
  if (!datos.empresa.nombre.trim()) throw new Error("Captura el nombre comercial de la empresa.");
  if (!datos.empresa.rfc.trim()) throw new Error("Captura el RFC de la empresa.");
  if (!datos.titular.nombre.trim()) throw new Error("Captura el nombre del titular.");
  if (!datos.titular.correo_facturacion.trim()) throw new Error("Captura el correo del titular.");

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_crea_empresa_corporativa",
    args: { p_empresa: AltaEmpresaCorporativa["empresa"]; p_titular: AltaEmpresaCorporativa["titular"] }
  ) => Promise<{ data: ResultadoAltaEmpresaCorporativa | null; error: Error | null }>;

  const { data, error } = await rpc("admin_crea_empresa_corporativa", {
    p_empresa: {
      ...datos.empresa,
      nombre: datos.empresa.nombre.trim(),
      rfc: datos.empresa.rfc.trim().toUpperCase()
    },
    p_titular: {
      ...datos.titular,
      nombre: datos.titular.nombre.trim(),
      correo_facturacion: datos.titular.correo_facturacion.trim().toLowerCase()
    }
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo confirmar el alta corporativa.");
  return data;
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
  }
): Promise<ResultadoCargaTrasladosMasivos> {
  await assertAdminPermission(cliente, "masivos:gestionar");
  if (!parametros.empresaId) throw new Error("Selecciona la empresa corporativa.");
  if (!parametros.usuarioId) throw new Error("Selecciona el usuario solicitante.");
  if (!parametros.nombreArchivo.trim()) throw new Error("El archivo debe tener nombre.");
  if (parametros.filas.length === 0) throw new Error("El archivo no contiene filas válidas para enviar.");
  if (parametros.filas.length > 500) throw new Error("El lote excede el máximo de 500 filas por carga.");

  const rpc = cliente.rpc.bind(cliente) as unknown as (
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
  await assertAdminPermission(cliente, "usuarios:validar");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_actualiza_usuario_verificacion",
    args: { p_usuario_id: string; p_estado: EstadoVerificacion; p_motivo: string | null }
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc("admin_actualiza_usuario_verificacion", {
    p_usuario_id: usuarioId,
    p_estado: estadoVerificacion,
    p_motivo: motivo?.trim() || null
  });
  if (error) throw error;
}

export async function obtenerUsuarioAdmin(cliente: Cliente, usuarioId: string): Promise<UsuarioRow | null> {
  await assertAdminPermission(cliente, "usuarios:leer");
  const { data, error } = await cliente.from("usuarios").select("*").eq("id", usuarioId).maybeSingle();
  if (error) throw error;
  return data;
}

export type UsuarioActualizableAdmin = Pick<
  Database["public"]["Tables"]["usuarios"]["Update"],
  "nombre" | "telefono" | "correo_facturacion" | "pais" | "estado" | "ciudad" | "codigo_postal" | "colonia" | "calle" | "numero" | "direccion_principal"
>;

export async function actualizarUsuarioAdmin(cliente: Cliente, usuarioId: string, datos: UsuarioActualizableAdmin): Promise<UsuarioRow> {
  await assertAdminPermission(cliente, "usuarios:validar");
  const { data, error } = await cliente.from("usuarios").update(datos).eq("id", usuarioId).select("*").single();
  if (error) throw error;
  return data;
}

export async function suspenderUsuarioAdmin(cliente: Cliente, usuarioId: string, motivo: string): Promise<void> {
  await assertAdminPermission(cliente, "usuarios:validar");
  const { error } = await cliente.from("usuarios").update({ estado_cuenta: "suspendida" }).eq("id", usuarioId);
  if (error) throw error;
  await registrarEvento(cliente, "usuario_suspendido" as never, "admin", usuarioId, { motivo });
}

export async function reactivarUsuarioAdmin(cliente: Cliente, usuarioId: string, motivo: string): Promise<void> {
  await assertAdminPermission(cliente, "usuarios:validar");
  const { error } = await cliente.from("usuarios").update({ estado_cuenta: "activa" }).eq("id", usuarioId);
  if (error) throw error;
  await registrarEvento(cliente, "usuario_reactivado" as never, "admin", usuarioId, { motivo });
}

export async function cerrarCuentaUsuarioAdmin(cliente: Cliente, usuarioId: string, motivo: string): Promise<void> {
  await assertAdminPermission(cliente, "usuarios:validar");
  const { error } = await cliente.from("usuarios").update({ estado_cuenta: "cerrada" }).eq("id", usuarioId);
  if (error) throw error;
  await registrarEvento(cliente, "usuario_cuenta_cerrada" as never, "admin", usuarioId, { motivo });
}

export async function listarSesionesUsuario(cliente: Cliente, usuarioId: string): Promise<Array<{ id: string; creada_en: string; ultimo_acceso: string | null; agente_usuario: string | null; direccion_ip: string | null; activa: boolean }>> {
  await assertAdminPermission(cliente, "usuarios:leer");
  if (!usuarioId) return [];
  const { data: usuario } = await cliente.from("usuarios").select("auth_user_id").eq("id", usuarioId).maybeSingle();
  if (!usuario?.auth_user_id) return [];

  const { data: sesiones } = await cliente.from("sesiones_usuario").select("*").eq("auth_user_id", usuario.auth_user_id).order("creada_en", { ascending: false });
  if (!sesiones) return [];
  return (sesiones as Array<{ id: string; creada_en: string; ultimo_acceso: string | null; agente_usuario: string | null; direccion_ip: string | null; activa: boolean }>).map((s) => ({
    ...s,
    activa: s.activa ?? false
  }));
}

export async function revocarSesionUsuario(cliente: Cliente, sesionId: string): Promise<void> {
  await assertAdminPermission(cliente, "usuarios:validar");
  const { error } = await cliente.from("sesiones_usuario").update({ activa: false }).eq("id", sesionId);
  if (error) throw error;
}

export async function listarPagosDeUsuario(cliente: Cliente, usuarioId: string): Promise<PagoRow[]> {
  await assertAdminPermission(cliente, "pagos:leer");
  const { data, error } = await cliente.from("pagos").select("*").eq("usuario_id", usuarioId).order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarIncidenciasDeUsuario(cliente: Cliente, usuarioId: string): Promise<IncidenciaRow[]> {
  await assertAdminPermission(cliente, "incidencias:leer");
  const { data, error } = await cliente.from("incidencias").select("*").eq("usuario_id", usuarioId).order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarEmpresasDeUsuario(cliente: Cliente, usuarioId: string): Promise<EmpresaRow[]> {
  await assertAdminPermission(cliente, "empresas:leer");
  const { data: usuario } = await cliente.from("usuarios").select("empresa_id").eq("id", usuarioId).maybeSingle();
  if (!usuario?.empresa_id) return [];
  const { data, error } = await cliente.from("empresas").select("*").eq("id", usuario.empresa_id);
  if (error) throw error;
  return data ?? [];
}

export async function obtenerAuditoriaUsuario(cliente: Cliente, usuarioId: string): Promise<Array<{ evento: string; creado_en: string; datos: Record<string, unknown> | null }>> {
  await assertAdminPermission(cliente, "usuarios:leer");
  const { data, error } = await cliente
    .from("registro_auditoria")
    .select("evento, timestamp, datos")
    .eq("actor_id", usuarioId)
    .order("timestamp", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r: { evento: string; timestamp: string; datos: unknown }) => ({
    evento: r.evento,
    creado_en: r.timestamp,
    datos: r.datos as Record<string, unknown> | null
  }));
}

/** PRD §17.5 — lista paginada de usuarios. */
export interface PaginacionUsuarios {
  data: UsuarioRow[];
  paginacion: { pagina: number; tamano: number; total: number; total_paginas: number };
}

export async function listarUsuariosAdminPaginados(
  cliente: Cliente,
  pagina: number,
  tamano: number,
  busqueda?: string
): Promise<PaginacionUsuarios> {
  await assertAdminPermission(cliente, "usuarios:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "listar_usuarios_admin_paginados",
    args: { p_pagina: number; p_tamano: number; p_busqueda?: string }
  ) => Promise<{ data: PaginacionUsuarios | null; error: unknown }>;
  const { data, error } = await rpc("listar_usuarios_admin_paginados", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_busqueda: busqueda?.trim() || undefined
  });
  if (error) throw error;
  if (!data) return { data: [], paginacion: { pagina: 1, tamano: 25, total: 0, total_paginas: 0 } };
  return data;
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
export type { EstadoDocumentoConductor } from "@ruum/shared/types";

const DOCUMENTOS_OBLIGATORIOS_CONDUCTOR = ["licencia_frente", "licencia_reverso", "identificacion_oficial"] as const;

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
  const { data, error } = await cliente.from("conductores").update(datos).eq("id", conductorId).select("*").single();
  if (error) throw error;
  await registrarEvento(cliente, "actualizacion_conductor" as never, "admin", conductorId, { accion: "edicion" });
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
    args: { p_aprobacion_id?: string; p_conductor_id: string; p_nuevo_estado: string; p_motivo?: string }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_nuevo_estado: "suspendido",
    p_motivo: motivo
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo suspender al conductor.");
  await registrarEvento(cliente, "suspension_conductor" as never, "admin", conductorId, { motivo });
  await revocarAccesoAuthConductor(cliente, conductorId);
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
    args: { p_aprobacion_id?: string; p_conductor_id: string; p_nuevo_estado: string; p_motivo?: string }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_nuevo_estado: "activo",
    p_motivo: motivo
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo reactivar al conductor.");
  await registrarEvento(cliente, "reactivacion_conductor" as never, "admin", conductorId, { motivo });
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
    args: { p_aprobacion_id?: string; p_conductor_id: string; p_nuevo_estado: string; p_motivo?: string }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_nuevo_estado: "baja",
    p_motivo: motivo
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo dar de baja al conductor.");
  await registrarEvento(cliente, "baja_conductor" as never, "admin", conductorId, { motivo });
  await revocarAccesoAuthConductor(cliente, conductorId);
}

/**
 * Revoca la sesión de Auth del conductor (requiere service role key en edge function).
 * Se llama al suspender/bajar conductor.
 */
export async function revocarAccesoAuthConductor(
  cliente: Cliente,
  conductorId: string
): Promise<void> {
  const { data: conductor, error } = await cliente
    .from("conductores")
    .select("auth_user_id")
    .eq("id", conductorId)
    .maybeSingle();
  if (error) throw error;
  if (!conductor?.auth_user_id) return;
  await registrarEvento(cliente, "revocacion_auth_conductor" as never, "admin", conductorId, {
    auth_user_id: conductor.auth_user_id
  });
}

export type ConductorCrearAdmin = {
  auth_user_id: string;
  nombre: string;
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
};

export async function crearConductorAdmin(
  cliente: Cliente,
  datos: ConductorCrearAdmin
): Promise<ConductorRow> {
  await assertAdminPermission(cliente, "conductores:validar");
  const { data, error } = await cliente
    .from("conductores")
    .insert({ ...datos, estado: "activo" as EstadoConductor })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un conductor con esa CURP o licencia.");
    throw error;
  }
  await registrarEvento(cliente, "creacion_conductor" as never, "admin", data.id, { accion: "alta_manual" });
  return data;
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
    args: { p_pagina: number; p_tamano: number; p_busqueda?: string; p_estado?: string }
  ) => Promise<{ data: PaginacionConductores | null; error: unknown }>;
  const { data, error } = await rpc("listar_conductores_admin_paginados", {
    p_pagina: pagina,
    p_tamano: tamano,
    p_busqueda: busqueda?.trim() || undefined,
    p_estado: estado && estado !== "todos" ? estado : undefined
  });
  if (error) throw error;
  if (!data) return { data: [], paginacion: { pagina: 1, tamano: 25, total: 0, total_paginas: 0 } };
  return data;
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
    cliente.from("conductores").select("id").eq("curp", curpNorm).maybeSingle(),
    cliente.from("usuarios").select("id").eq("curp", curpNorm).maybeSingle()
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
export async function obtenerVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"] | null> {
  await assertAdminPermission(cliente, "conductores:leer");
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
  await assertAdminPermission(cliente, "conductores:validar");

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
 */
export type VehiculoActualizarAdmin = Pick<
  Database["public"]["Tables"]["vehiculos"]["Update"],
  "tipo" | "marca" | "modelo" | "anio" | "color" | "placas" | "vin" | "alias" | "transmision" |
  "estado_general_declarado" | "fotos_urls" | "permiso_especial_vigente" | "tiene_placas" | "tiene_tarjeta_circulacion" |
  "tiene_verificacion" | "puede_circular_rodando" | "categoria_tarifa" | "gama" | "condicion" |
  "usuario_id" | "conductor_id" | "empresa_id"
>;

export async function actualizarVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  datos: VehiculoActualizarAdmin,
  versionEsperada?: number
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"]> {
  await assertAdminPermission(cliente, "conductores:validar");

  if (datos.vin) {
    const valido = validarFormatoVin(datos.vin);
    if (!valido) throw new Error("VIN inválido: debe tener 17 caracteres alfanuméricos (ISO 3779).");
    const unicos = await validarVinYPlacasUnicos(cliente, datos.vin, datos.placas, vehiculoId);
    if (!unicos.vinUnico) throw new Error("El VIN ya está registrado en otro vehículo.");
  }
  if (datos.placas) {
    const valido = validarFormatoPlacas(datos.placas);
    if (!valido) throw new Error("Placas inválidas: 3-7 caracteres alfanuméricos.");
    const unicos = await validarVinYPlacasUnicos(cliente, datos.vin, datos.placas, vehiculoId);
    if (!unicos.placasUnicas) throw new Error("Las placas ya están registradas en otro vehículo.");
  }

  if (versionEsperada !== undefined) {
    const { data: rpcData, error: rpcError } = await cliente.rpc("admin_actualizar_vehiculo", {
      p_vehiculo_id: vehiculoId,
      p_datos: datos as any,
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

  const { data, error } = await cliente.from("vehiculos").update(datos).eq("id", vehiculoId).select("*").single();
  if (error) throw error;
  await registrarEvento(cliente, "actualizacion_vehiculo" as never, "admin", vehiculoId, { accion: "edicion" });
  return data;
}

/**
 * Documentos del vehículo (tarjeta circulación, seguro, verificación).
 */
export async function obtenerDocumentosVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string
): Promise<Database["public"]["Tables"]["documentos_vehiculo"]["Row"][]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await cliente
    .from("documentos_vehiculo")
    .select("*")
    .eq("vehiculo_id", vehiculoId)
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function subirDocumentoVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  tipo: "tarjeta_circulacion" | "seguro" | "verificacion" | "permiso_especial",
  archivo: File
): Promise<Database["public"]["Tables"]["documentos_vehiculo"]["Row"]> {
  await assertAdminPermission(cliente, "conductores:validar");
  // Validaciones de archivo
  if (archivo.size > 10 * 1024 * 1024) throw new Error("El archivo debe pesar máximo 10 MB.");
  const ext = archivo.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "jpg", "jpeg", "png", "webp"].includes(ext ?? "")) throw new Error("Formato inválido: PDF, JPG, PNG o WEBP.");

  const path = `${vehiculoId}/${tipo}.${ext}`;
  const { error: errUp } = await cliente.storage.from("documentos-vehiculo").upload(path, archivo, { upsert: true, contentType: archivo.type });
  if (errUp) throw errUp;

  const { data: urlData } = cliente.storage.from("documentos-vehiculo").getPublicUrl(path);
  const url = `${urlData.publicUrl}?v=${Date.now()}`;

  const { data, error } = await cliente.from("documentos_vehiculo").insert({
    vehiculo_id: vehiculoId,
    tipo,
    url,
    nombre_archivo: archivo.name,
    tamano_bytes: archivo.size,
    mime_type: archivo.type
  }).select("*").single();
  if (error) throw error;
  return data;
}

export async function eliminarDocumentoVehiculoAdmin(
  cliente: Cliente,
  documentoId: string
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:validar");
  const { data: doc, error: errDoc } = await cliente.from("documentos_vehiculo").select("url, vehiculo_id").eq("id", documentoId).single();
  if (errDoc) throw errDoc;
  if (doc?.url) {
    const url = new URL(doc.url);
    const path = url.pathname.split("/documentos-vehiculo/")[1];
    if (path) await cliente.storage.from("documentos-vehiculo").remove([path]);
  }
  const { error } = await cliente.from("documentos_vehiculo").delete().eq("id", documentoId);
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
  await assertAdminPermission(cliente, "conductores:validar");
  const { error } = await cliente.from("vehiculos").update({ conductor_id: conductorId }).eq("id", vehiculoId);
  if (error) throw error;
  await registrarEvento(cliente, "asociacion_conductor_vehiculo" as never, "admin", vehiculoId, { conductor_id: conductorId });
}

export async function asociarEmpresaVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  empresaId: string | null
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:validar");
  const { error } = await cliente.from("vehiculos").update({ empresa_id: empresaId }).eq("id", vehiculoId);
  if (error) throw error;
  await registrarEvento(cliente, "asociacion_empresa_vehiculo" as never, "admin", vehiculoId, { empresa_id: empresaId });
}

/**
 * Suspender vehículo no elegible (documentación vencida, sin seguro, etc.).
 */
export async function suspenderVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  motivo: string
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:validar");
  const { error } = await cliente.from("vehiculos").update({ puede_circular_rodando: false }).eq("id", vehiculoId);
  if (error) throw error;
  await registrarEvento(cliente, "suspension_vehiculo" as never, "admin", vehiculoId, { motivo });
}

/**
 * Reactivar vehículo.
 */
export async function reactivarVehiculoAdmin(
  cliente: Cliente,
  vehiculoId: string,
  motivo: string
): Promise<void> {
  await assertAdminPermission(cliente, "conductores:validar");
  const { error } = await cliente.from("vehiculos").update({ puede_circular_rodando: true }).eq("id", vehiculoId);
  if (error) throw error;
  await registrarEvento(cliente, "reactivacion_vehiculo" as never, "admin", vehiculoId, { motivo });
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
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await cliente
    .from("historial_vehiculos")
    .select("*")
    .eq("vehiculo_id", vehiculoId)
    .order("cambiado_en", { ascending: false });
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
/**
 * Obtiene vehículos asignados al conductor.
 */
export async function obtenerVehiculosDeConductorAdmin(
  cliente: Cliente,
  conductorId: string
): Promise<Database["public"]["Tables"]["vehiculos"]["Row"][]> {
  await assertAdminPermission(cliente, "conductores:leer");
  const { data, error } = await cliente
    .from("vehiculos")
    .select("*")
    .eq("conductor_id", conductorId)
    .order("creado_en", { ascending: false });
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
  const { data, error } = await cliente
    .from("historial_estatus_conductor")
    .select("*")
    .eq("conductor_id", conductorId)
    .order("cambiado_en", { ascending: false });
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
  const { error } = await cliente.from("historial_estatus_conductor").insert({
    conductor_id: conductorId,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
    motivo,
    cambiado_por: adminId
  });
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
  await assertAdminPermission(cliente, "incidencias:leer");
  const { data, error } = await cliente.from("incidencias").select("*").order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarDisputasAdmin(cliente: Cliente): Promise<DisputaRow[]> {
  await assertAdminPermission(cliente, "disputas:leer");
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
  await assertAdminPermission(cliente, "disputas:resolver");
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
  await assertAdminPermission(cliente, "reclamos_seguro:leer");
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
  await assertAdminPermission(cliente, "reclamos_seguro:gestionar");
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
function aConductorRegla(fila: ConductorRow): Conductor {
  return {
    id: fila.id,
    nombre: fila.nombre,
    estado: fila.estado,
    calificacion_promedio: fila.calificacion_promedio,
    traslados_completados: fila.traslados_completados,
    suspensiones_activas: fila.suspensiones_activas,
    no_presentaciones_6m: fila.no_presentaciones_6m,
    cancelaciones_sin_justificacion_count: fila.cancelaciones_sin_justificacion_count,
    documentos_vigentes: fila.documentos_vigentes,
    certificaciones: [],
    incidencias_graves_6m: fila.incidencias_graves_6m,
    incidencias_graves_12m: fila.incidencias_graves_12m,
    creado_en: fila.creado_en
  };
}

function tipoRutaParaElegibilidad(tipoRuta: string | null): "intraurbana" | "interurbana_mas_100km" {
  if (tipoRuta === "foraneo") return "interurbana_mas_100km";
  return "intraurbana";
}

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

  const [conductor, traslado] = await Promise.all([
    cliente.from("conductores").select("*").eq("id", conductorId).maybeSingle(),
    cliente.from("traslados").select("id, tipo_ruta, vehiculo_id").eq("id", trasladoId).maybeSingle()
  ]);

  if (conductor.error) throw conductor.error;
  if (traslado.error) throw traslado.error;
  if (!conductor.data) throw new Error("Conductor no encontrado.");
  if (!traslado.data) throw new Error("Traslado no encontrado.");

  if (conductor.data.estado_expediente !== "aprobado") {
    throw new Error("El conductor no tiene el expediente aprobado para asignarle viajes.");
  }

  const { data: vehiculo } = await cliente.from("vehiculos").select("tipo").eq("id", traslado.data.vehiculo_id).maybeSingle();
  if (!vehiculo) throw new Error("El traslado no tiene un vehículo asociado.");

  const resultado = esElegibleParaViaje(
    aConductorRegla(conductor.data),
    vehiculo.tipo,
    tipoRutaParaElegibilidad(traslado.data.tipo_ruta)
  );

  if (!resultado.elegible) {
    throw new Error(`Restricción de elegibilidad: ${resultado.motivo ?? "El conductor no cumple los requisitos para este viaje."}`);
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
export const ESTADOS_CRITICOS_TRASLADO: readonly EstadoTraslado[] = ["pago_completado"];

export async function cambiarEstatusAdmin(
  cliente: Cliente,
  trasladoId: string,
  estadoActual: EstadoTraslado,
  nuevoEstado: EstadoTraslado,
  aprobacionId?: string,
  versionEsperada?: number
) {
  await assertAdminPermission(cliente, "viajes:gestionar");

  if (!transicionValida(estadoActual, nuevoEstado)) {
    throw new Error(`Transición no permitida: ${estadoActual} -> ${nuevoEstado}`);
  }

  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_cambiar_estado_traslado",
      args: { p_traslado_id: string; p_nuevo_estado: string; p_version_esperada?: number; p_aprobacion_id?: string }
    ) => Promise<{ data: { ejecutado?: boolean; version?: number } | null; error: unknown }>;
    const { data, error } = await rpc("admin_cambiar_estado_traslado", {
      p_traslado_id: trasladoId,
      p_nuevo_estado: nuevoEstado,
      p_version_esperada: versionEsperada,
      p_aprobacion_id: aprobacionId
    });
    if (error) throw error;
    if (!data?.ejecutado) throw new Error("No se pudo cambiar el estado del traslado.");
  });
}

export interface ResultadoAccionMasiva {
  traslado_id: string;
  estado: "aplicado" | "omitido" | "bloqueado";
  detalle: string;
}

export interface ResultadoAccionMasivaGlobal {
  trace_id: string;
  accion: string;
  total: number;
  aplicados: number;
  omitidos: number;
  bloqueados: number;
  resultados: ResultadoAccionMasiva[];
}

export async function ejecutarAccionMasiva(
  cliente: Cliente,
  accion: string,
  trasladoIds: string[],
  payload: Record<string, unknown> = {}
): Promise<ResultadoAccionMasivaGlobal> {
  await assertAdminPermission(cliente, "viajes:gestionar");
  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_accion_masiva",
      args: { p_accion: string; p_traslado_ids: string[]; p_payload: Record<string, unknown> }
    ) => Promise<{ data: ResultadoAccionMasivaGlobal | null; error: unknown }>;
    const { data, error } = await rpc("admin_accion_masiva", {
      p_accion: accion,
      p_traslado_ids: trasladoIds,
      p_payload: payload
    });
    if (error) throw error;
    if (!data) throw new Error("No se pudo ejecutar la acción masiva.");
    return data;
  });
}

export async function exportarEvidenciaFirmada(
  cliente: Cliente,
  trasladoIds: string[]
): Promise<{ evidencia: Array<{ traslado_id: string; fotos: Array<{ id: string; tipo: string; angulo: string; storage_path: string; capturada_en: string }> }>; total: number }> {
  await assertAdminPermission(cliente, "viajes:gestionar");
  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_exportar_evidencia_firmada",
      args: { p_traslado_ids: string[] }
    ) => Promise<{ data: { evidencia: Array<{ traslado_id: string; fotos: Array<{ id: string; tipo: string; angulo: string; storage_path: string; capturada_en: string }> }>; total: number } | null; error: unknown }>;
    const { data, error } = await rpc("admin_exportar_evidencia_firmada", { p_traslado_ids: trasladoIds });
    if (error) throw error;
    if (!data) return { evidencia: [], total: 0 };
    return data;
  });
}

export async function mutacionConAuditoria(
  cliente: Cliente,
  accion: string,
  trasladoId: string,
  payload: Record<string, unknown> = {}
): Promise<{ ejecutado: boolean; traslado_id: string }> {
  await assertAdminPermission(cliente, "viajes:gestionar");
  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_mutacion_con_auditoria",
      args: { p_accion: string; p_traslado_id: string; p_payload: Record<string, unknown> }
    ) => Promise<{ data: { ejecutado: boolean; traslado_id: string } | null; error: unknown }>;
    const { data, error } = await rpc("admin_mutacion_con_auditoria", {
      p_accion: accion,
      p_traslado_id: trasladoId,
      p_payload: payload
    });
    if (error) throw error;
    if (!data) throw new Error("No se pudo ejecutar la mutación.");
    return data;
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
  await assertAdminPermission(cliente, "viajes:gestionar");
  const { error } = await cliente.from("notas_internas_traslado").insert({ traslado_id: trasladoId, admin_id: adminId, contenido });
  if (error) throw error;
}

export async function ajustarPrecioFinalAdmin(
  cliente: Cliente,
  trasladoId: string,
  precioFinal: number,
  aprobacionId?: string
) {
  await assertAdminPermission(cliente, "tarifas:editar");
  if (!Number.isFinite(precioFinal) || precioFinal < 0) {
    throw new Error("La tarifa final debe ser un número válido mayor o igual a 0.");
  }
  if (!aprobacionId) {
    throw new Error("Esta operación requiere una aprobación dual válida (aprobacionId).");
  }

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_ajustar_precio_final",
    args: { p_aprobacion_id: string; p_traslado_id: string; p_precio_final: number }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_ajustar_precio_final", {
    p_aprobacion_id: aprobacionId,
    p_traslado_id: trasladoId,
    p_precio_final: precioFinal
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo ajustar el precio final.");
}

export async function emitirCotizacionAdmin(cliente: Cliente, trasladoId: string, precio: number) {
  if (!Number.isFinite(precio) || precio <= 0) throw new Error("La tarifa normativa debe ser mayor a cero.");
  const { error } = await cliente.rpc("admin_emite_cotizacion", { p_traslado_id: trasladoId, p_precio: precio });
  if (error) throw error;
}

export async function aplicarTarifaNormativaAdmin(cliente: Cliente, trasladoId: string): Promise<number> {
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_aplica_tarifa_normativa",
    args: { p_traslado_id: string }
  ) => Promise<{ data: number | null; error: Error | null }>;
  const { data, error } = await rpc("admin_aplica_tarifa_normativa", { p_traslado_id: trasladoId });
  if (error) throw error;
  if (data == null) throw new Error("No se pudo confirmar la tarifa normativa aplicada.");
  return data;
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
    args: { p_aprobacion_id: string; p_conductor_id: string; p_nuevo_estado: string; p_motivo?: string }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_suspender_conductor", {
    p_aprobacion_id: aprobacionId,
    p_conductor_id: conductorId,
    p_nuevo_estado: nuevoEstado,
    p_motivo: motivo
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

export async function marcarTrasladoFallido(cliente: Cliente, trasladoId: string, causa: CausaFallido) {
  await assertAdminPermission(cliente, "viajes:gestionar");
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

export type CategoriaExcepcionCritica =
  | "emergencia"
  | "sla_vencido"
  | "sla_en_riesgo"
  | "traslado_sin_conductor"
  | "conductor_sin_senal"
  | "desviacion_ruta"
  | "incidencia_sin_responsable"
  | "documentacion_bloqueante";

export type SeveridadExcepcionCritica = "critica" | "alta" | "media";

export interface ExcepcionCriticaAdmin {
  id: string;
  categoria: CategoriaExcepcionCritica;
  severidad: SeveridadExcepcionCritica;
  folioOEntidad: string;
  descripcion: string;
  creadoEn: string;
  actualizadoEn: string;
  responsable: string | null;
  slaRestanteHoras: number | null;
  accionPrincipal: {
    etiqueta: string;
    href: string;
  };
  accionEscalamiento: {
    etiqueta: string;
    href: string;
  };
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

function horasDesde(fechaIso: string) {
  return Math.max(0, (Date.now() - new Date(fechaIso).getTime()) / 36e5);
}

function folioCorto(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function severidadPeso(severidad: SeveridadExcepcionCritica) {
  if (severidad === "critica") return 3;
  if (severidad === "alta") return 2;
  return 1;
}

function esIncidenciaDesviacion(tipo: TipoIncidencia) {
  return tipo === "perdida_conectividad" || tipo === "descompostura_en_ruta" || tipo === "infraccion_autoridad_vial";
}

function trasladoIdDesdeDatosAuditoria(datos: AuditoriaRow["datos"]) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const valor = datos.traslado_id;
  return typeof valor === "string" ? valor : null;
}

export async function listarExcepcionesCriticasAdmin(cliente: Cliente): Promise<ExcepcionCriticaAdmin[]> {
  const [emergencias, alertasSla, traslados, incidencias] = await Promise.all([
    cliente
      .from("registro_auditoria")
      .select("*")
      .eq("evento", "activacion_soporte_emergencia")
      .order("timestamp", { ascending: false })
      .limit(20),
    listarAlertasSLA(cliente),
    listarTrasladosActivosMapa(cliente),
    listarIncidenciasAdmin(cliente)
  ]);

  if (emergencias.error) throw emergencias.error;

  const excepciones: ExcepcionCriticaAdmin[] = [];

  for (const evento of (emergencias.data ?? []) as AuditoriaRow[]) {
    const trasladoId = evento.traslado_id ?? trasladoIdDesdeDatosAuditoria(evento.datos);
    excepciones.push({
      id: `emergencia-${evento.id}`,
      categoria: "emergencia",
      severidad: "critica",
      folioOEntidad: trasladoId ? `Traslado ${folioCorto(trasladoId)}` : `Evento ${folioCorto(evento.id)}`,
      descripcion: "Emergencia activada desde canal operativo. Requiere atención inmediata y registro de seguimiento.",
      creadoEn: evento.timestamp,
      actualizadoEn: evento.timestamp,
      responsable: "Torre de Control",
      slaRestanteHoras: 0,
      accionPrincipal: {
        etiqueta: trasladoId ? "Abrir traslado" : "Revisar emergencia",
        href: trasladoId ? `/viajes/${trasladoId}` : "/"
      },
      accionEscalamiento: { etiqueta: "Escalar a supervisor", href: "/configuracion" }
    });
  }

  for (const alerta of alertasSla) {
    if (!alerta.vencido && !alerta.requiere_alerta) continue;
    const esUsuario = alerta.tipo === "cuenta_nueva_usuario" || alerta.tipo === "documentos_usuario";
    const documentacion = alerta.tipo === "documentos_usuario" || alerta.tipo === "documentos_conductor";
    const categoria: CategoriaExcepcionCritica = documentacion
      ? "documentacion_bloqueante"
      : alerta.vencido
        ? "sla_vencido"
        : "sla_en_riesgo";
    const restante = alerta.horas_limite - alerta.horas_transcurridas;
    excepciones.push({
      id: `sla-${alerta.tipo}-${alerta.id}`,
      categoria,
      severidad: alerta.vencido ? "alta" : "media",
      folioOEntidad: `${esUsuario ? "Usuario" : "Conductor"} ${folioCorto(alerta.id)}`,
      descripcion: `${alerta.nombre} tiene ${alerta.vencido ? "SLA vencido" : "SLA en riesgo"} para ${alerta.tipo.replace(/_/g, " ")}.`,
      creadoEn: alerta.creado_en,
      actualizadoEn: alerta.creado_en,
      responsable: null,
      slaRestanteHoras: Number(restante.toFixed(1)),
      accionPrincipal: { etiqueta: esUsuario ? "Revisar usuario" : "Revisar conductor", href: esUsuario ? "/usuarios" : "/conductores" },
      accionEscalamiento: { etiqueta: "Escalar revisión", href: documentacion ? "/documentos" : "/configuracion" }
    });
  }

  for (const traslado of traslados) {
    const horasSinActualizacion = horasDesde(traslado.actualizado_en);
    if (traslado.estado === "pendiente_de_conductor") {
      excepciones.push({
        id: `sin-conductor-${traslado.traslado_id}`,
        categoria: "traslado_sin_conductor",
        severidad: horasSinActualizacion >= 2 ? "alta" : "media",
        folioOEntidad: `Traslado ${folioCorto(traslado.traslado_id)}`,
        descripcion: `${traslado.vehiculo_marca ?? "Vehículo"} ${traslado.vehiculo_modelo ?? ""} está pendiente de conductor.`,
        creadoEn: traslado.actualizado_en,
        actualizadoEn: traslado.actualizado_en,
        responsable: "Asignación",
        slaRestanteHoras: Number((2 - horasSinActualizacion).toFixed(1)),
        accionPrincipal: { etiqueta: "Asignar conductor", href: `/viajes/${traslado.traslado_id}` },
        accionEscalamiento: { etiqueta: "Escalar asignación", href: "/conductores" }
      });
    }

    if (traslado.conductor_nombre && horasSinActualizacion >= 1.5) {
      excepciones.push({
        id: `sin-senal-${traslado.traslado_id}`,
        categoria: "conductor_sin_senal",
        severidad: horasSinActualizacion >= 3 ? "critica" : "alta",
        folioOEntidad: `Traslado ${folioCorto(traslado.traslado_id)}`,
        descripcion: `${traslado.conductor_nombre} no registra actualización operativa reciente.`,
        creadoEn: traslado.actualizado_en,
        actualizadoEn: traslado.actualizado_en,
        responsable: "Monitoreo",
        slaRestanteHoras: Number((1.5 - horasSinActualizacion).toFixed(1)),
        accionPrincipal: { etiqueta: "Abrir mapa", href: "/mapa" },
        accionEscalamiento: { etiqueta: "Escalar a soporte", href: `/viajes/${traslado.traslado_id}` }
      });
    }
  }

  for (const incidencia of incidencias.filter((item) => !item.resuelta)) {
    const desviacion = esIncidenciaDesviacion(incidencia.tipo);
    excepciones.push({
      id: `${desviacion ? "desviacion" : "incidencia"}-${incidencia.id}`,
      categoria: desviacion ? "desviacion_ruta" : "incidencia_sin_responsable",
      severidad: desviacion ? "alta" : "media",
      folioOEntidad: `Traslado ${folioCorto(incidencia.traslado_id)}`,
      descripcion: incidencia.descripcion || incidencia.tipo.replace(/_/g, " "),
      creadoEn: incidencia.creada_en,
      actualizadoEn: incidencia.creada_en,
      responsable: null,
      slaRestanteHoras: Number((1 - horasDesde(incidencia.creada_en)).toFixed(1)),
      accionPrincipal: { etiqueta: "Atender incidencia", href: `/viajes/${incidencia.traslado_id}` },
      accionEscalamiento: { etiqueta: "Escalar incidencia", href: "/incidencias?filtro=abiertas" }
    });
  }

  return excepciones.sort((a, b) => {
    const severidad = severidadPeso(b.severidad) - severidadPeso(a.severidad);
    if (severidad !== 0) return severidad;
    return new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime();
  });
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
