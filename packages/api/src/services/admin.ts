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

/**
 * PRD §17.4 — "asignar o cambiar conductor". A diferencia de
 * services/traslados.ts::aceptarViaje (autoservicio del conductor, limitado
 * por RLS a pendiente_de_conductor), esto es la acción de Admin: puede
 * asignar o reasignar sin esa restricción, porque admin_acceso_total_traslados
 * (0005) ya le da acceso total vía es_admin(). Si el traslado todavía no
 * tiene conductor, también avanza el estado; si ya lo tenía (reasignación),
 * solo cambia conductor_id sin tocar estado.
 */
export async function asignarConductorAdmin(
  cliente: Cliente,
  trasladoId: string,
  conductorId: string,
  estadoActual: EstadoTraslado
) {
  const cambios: { conductor_id: string; estado?: EstadoTraslado } = { conductor_id: conductorId };
  if (estadoActual === "pendiente_de_conductor") {
    cambios.estado = "conductor_asignado";
  }

  const { error } = await cliente.from("traslados").update(cambios).eq("id", trasladoId);
  if (error) throw error;
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
