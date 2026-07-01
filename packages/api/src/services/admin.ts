import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { transicionValida } from "@ruum/shared/states";
import { evidenciaCompleta } from "@ruum/shared/rules";
import { consecuenciaCancelacionConductor, consecuenciaNoPresentacion, clasificarTrasladoFallido } from "@ruum/shared/rules";
import type { FotoEvidencia } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EmpresaRow = Database["public"]["Tables"]["empresas"]["Row"];
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type DisputaRow = Database["public"]["Tables"]["disputas"]["Row"];
type ReclamoSeguroRow = Database["public"]["Tables"]["reclamos_seguro"]["Row"];
type PagoRow = Database["public"]["Tables"]["pagos"]["Row"];
type PayoutRow = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type CuentaStripeConductorRow = Database["public"]["Tables"]["cuentas_conductor_stripe"]["Row"];
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
  cuentasStripeConductores: CuentaStripeConductorRow[];
  conductores: ConductorRow[];
}

export interface DatosEmpresasAdmin {
  empresas: EmpresaRow[];
  usuarios: UsuarioRow[];
  traslados: TrasladoRow[];
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

/** PRD §17.5 — lista de usuarios. */
export async function listarUsuariosAdmin(cliente: Cliente): Promise<UsuarioRow[]> {
  const { data, error } = await cliente.from("usuarios").select("*").order("creado_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listarPagosAdmin(cliente: Cliente): Promise<DatosPagosAdmin> {
  const [pagos, pasaportes, payouts, cuentasStripe, conductores] = await Promise.all([
    cliente.from("pagos").select("*").order("registrado_en", { ascending: false }),
    cliente.from("pasaporte_digital").select("*").order("creado_en", { ascending: false }),
    cliente.from("payouts_conductor").select("*").order("periodo_inicio", { ascending: false }),
    cliente.from("cuentas_conductor_stripe").select("*").order("actualizado_en", { ascending: false }),
    cliente.from("conductores").select("*").order("creado_en", { ascending: false })
  ]);

  for (const resultado of [pagos, pasaportes, payouts, cuentasStripe, conductores]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    pagosUsuarios: pagos.data ?? [],
    pasaportes: pasaportes.data ?? [],
    payoutsConductores: payouts.data ?? [],
    cuentasStripeConductores: cuentasStripe.data ?? [],
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

export async function validarDocumentoUsuario(cliente: Cliente, usuarioId: string, estadoVerificacion: EstadoVerificacion) {
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { error } = await cliente
    .from("usuarios")
    .update({ estado_verificacion: estadoVerificacion })
    .eq("id", usuarioId);

  if (error) throw error;

  await registrarEvento(cliente, "validacion_documentos", "admin", adminId, {
    usuario_id: usuarioId,
    estado_verificacion: estadoVerificacion
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
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { data: disputa, error: errorDisputa } = await cliente
    .from("disputas")
    .select("*")
    .eq("id", disputaId)
    .maybeSingle();

  if (errorDisputa) throw errorDisputa;
  if (!disputa) throw new Error("No se encontró la disputa.");

  const esEstadoResuelto = estado === "resuelta" || estado === "resuelta_senior";
  if (esEstadoResuelto && !resolucion) {
    throw new Error("Selecciona una resolución para cerrar la disputa.");
  }

  const { error } = await cliente
    .from("disputas")
    .update({
      estado,
      resolucion: esEstadoResuelto ? resolucion : null,
      resolucion_detalle: detalle.trim() || null,
      resuelta_en: esEstadoResuelto ? new Date().toISOString() : null
    })
    .eq("id", disputaId);

  if (error) throw error;

  if (esEstadoResuelto) {
    const { data: traslado } = await cliente.from("traslados").select("estado").eq("id", disputa.traslado_id).maybeSingle();
    if (traslado?.estado === "disputa_abierta") {
      await cliente.from("traslados").update({ estado: "disputa_resuelta" }).eq("id", disputa.traslado_id);
    }
  }

  await registrarEvento(cliente, "resolucion_disputa", "admin", adminId, {
    traslado_id: disputa.traslado_id,
    disputa_id: disputaId,
    estado,
    resolucion,
    detalle: detalle.trim() || null
  });
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
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const { data: reclamo, error: errorReclamo } = await cliente
    .from("reclamos_seguro")
    .select("*")
    .eq("id", reclamoId)
    .maybeSingle();

  if (errorReclamo) throw errorReclamo;
  if (!reclamo) throw new Error("No se encontró el reclamo.");
  if (estado === "resuelto" && !responsablePago) {
    throw new Error("Selecciona responsable de pago antes de resolver el reclamo.");
  }

  const { error } = await cliente
    .from("reclamos_seguro")
    .update({
      estado,
      responsable_pago: responsablePago,
      notas_admin: notasAdmin.trim() || null,
      resuelto_en: estado === "resuelto" ? new Date().toISOString() : null
    })
    .eq("id", reclamoId);

  if (error) throw error;

  if (estado === "resuelto") {
    const { data: traslado } = await cliente.from("traslados").select("estado").eq("id", reclamo.traslado_id).maybeSingle();
    if (traslado?.estado === "reclamo_abierto") {
      await cliente.from("traslados").update({ estado: "reclamo_resuelto" }).eq("id", reclamo.traslado_id);
    }
  }

  await registrarEvento(cliente, estado === "resuelto" ? "resolucion_reclamo_seguro" : "apertura_reclamo_seguro", "admin", adminId, {
    traslado_id: reclamo.traslado_id,
    reclamo_id: reclamoId,
    estado,
    responsable_pago: responsablePago,
    notas: notasAdmin.trim() || null
  });
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
  const adminId = await obtenerAdminIdParaAuditoria(cliente);

  if (estadoActual === "conductor_asignado") {
    // Reasignación pura: el viaje ya está en el paso correcto, solo cambia
    // a quién pertenece — no hay ningún estado que avanzar.
    const { error } = await cliente.from("traslados").update({ conductor_id: conductorId }).eq("id", trasladoId);
    if (error) throw error;
    await registrarEvento(cliente, "asignacion_conductor", "admin", adminId, {
      traslado_id: trasladoId,
      conductor_id: conductorId,
      estado_anterior: estadoActual,
      estado_nuevo: estadoActual
    });
    return;
  }

  const indiceActual = CADENA_HASTA_CONDUCTOR_ASIGNADO.indexOf(estadoActual);
  if (indiceActual === -1) {
    throw new Error(
      `No se puede asignar conductor desde el estado "${estadoActual}" — ese estado no forma parte del camino hacia conductor_asignado (¿el viaje ya está en tránsito, cancelado, o fallido?).`
    );
  }

  // conductor_id se fija desde el primer salto: si algo falla a media
  // cadena, el viaje queda con dueño claro y un admin puede seguir
  // avanzándolo a mano desde donde se quedó, en vez de perder el dato.
  let primero = true;
  for (let i = indiceActual; i < CADENA_HASTA_CONDUCTOR_ASIGNADO.length - 1; i++) {
    const siguiente = CADENA_HASTA_CONDUCTOR_ASIGNADO[i + 1];
    if (!siguiente) {
      // No debería pasar nunca dado el límite del for — si pasa, es un bug
      // real en CADENA_HASTA_CONDUCTOR_ASIGNADO, no un caso de negocio.
      throw new Error("Error interno: cadena de transición hacia conductor_asignado mal formada.");
    }
    const cambios: { conductor_id?: string; estado: EstadoTraslado } = { estado: siguiente };
    if (primero) {
      cambios.conductor_id = conductorId;
      primero = false;
    }
    const { error } = await cliente.from("traslados").update(cambios).eq("id", trasladoId);
    if (error) throw error;
  }

  await registrarEvento(cliente, "asignacion_conductor", "admin", adminId, {
    traslado_id: trasladoId,
    conductor_id: conductorId,
    estado_anterior: estadoActual,
    estado_nuevo: "conductor_asignado"
  });
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
  const adminId = await obtenerAdminIdParaAuditoria(cliente);
  const resultado = clasificarTrasladoFallido(causa);

  const { data: traslado, error: errorTraslado } = await cliente
    .from("traslados")
    .select("id, estado, precio_cotizado, precio_final")
    .eq("id", trasladoId)
    .maybeSingle();

  if (errorTraslado) throw errorTraslado;
  if (!traslado) throw new Error("No se encontró el traslado.");

  const { error } = await cliente
    .from("traslados")
    .update({ estado: "traslado_fallido", causa_fallido: causa })
    .eq("id", trasladoId)
    .eq("estado", traslado.estado);

  if (error) throw error;

  if (resultado.cargo_aplica_cliente) {
    const { error: pagoError } = await cliente.from("pagos").insert({
      traslado_id: trasladoId,
      monto: Number(traslado.precio_final ?? traslado.precio_cotizado ?? 0),
      momento: "al_cierre",
      estado: "pendiente",
      metodo: "cargo_traslado_fallido"
    });
    if (pagoError) throw pagoError;
  }

  await registrarEvento(cliente, "modificacion_traslado_activo", "admin", adminId, {
    traslado_id: trasladoId,
    tipo: "traslado_fallido",
    causa,
    estado_anterior: traslado.estado,
    estado_nuevo: "traslado_fallido",
    cargo_aplica_cliente: resultado.cargo_aplica_cliente,
    requiere_reagendamiento: resultado.requiere_reagendamiento,
    porcentaje_descuento_segundo_intento: resultado.porcentaje_descuento_segundo_intento ?? null,
    mensaje: resultado.mensaje
  });

  return resultado;
}
