import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { transicionValida } from "@ruum/shared/states";

type Cliente = SupabaseClient<Database>;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type NotaRow = Database["public"]["Tables"]["notas_internas_traslado"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type EstadoConductor = Database["public"]["Enums"]["estado_conductor"];

/** Admin asociado a la sesión de Supabase Auth actual, si existe (mismo patrón que obtenerUsuarioActual/obtenerConductorActual). */
export async function obtenerAdminActual(cliente: Cliente) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await cliente.from("admins").select("*").eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

const ESTADOS_TERMINALES: EstadoTraslado[] = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];

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

/** PRD §17.8 — lista de incidencias. */
export async function listarIncidenciasAdmin(cliente: Cliente): Promise<IncidenciaRow[]> {
  const { data, error } = await cliente.from("incidencias").select("*").order("creada_en", { ascending: false });
  if (error) throw error;
  return data ?? [];
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
  if (estadoActual === "conductor_asignado") {
    // Reasignación pura: el viaje ya está en el paso correcto, solo cambia
    // a quién pertenece — no hay ningún estado que avanzar.
    const { error } = await cliente.from("traslados").update({ conductor_id: conductorId }).eq("id", trasladoId);
    if (error) throw error;
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
}

/**
 * PRD §17.4 — "cambiar estatus". Valida contra TRANSICIONES (mismo mapa que
 * el trigger de Postgres en 0005) antes de intentarlo, para dar un mensaje
 * claro en vez de depender solo del error crudo de la base.
 */
export async function cambiarEstatusAdmin(
  cliente: Cliente,
  trasladoId: string,
  estadoActual: EstadoTraslado,
  nuevoEstado: EstadoTraslado
) {
  if (!transicionValida(estadoActual, nuevoEstado)) {
    throw new Error(`Transición no permitida: ${estadoActual} -> ${nuevoEstado}`);
  }

  const { error } = await cliente.from("traslados").update({ estado: nuevoEstado }).eq("id", trasladoId).eq("estado", estadoActual);
  if (error) throw error;
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

/** PRD §17.6 — "suspender/reactivar" conductor. */
export async function cambiarEstadoConductorAdmin(cliente: Cliente, conductorId: string, nuevoEstado: EstadoConductor) {
  const { error } = await cliente.from("conductores").update({ estado: nuevoEstado }).eq("id", conductorId);
  if (error) throw error;
}
