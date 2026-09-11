import type { SupabaseClient, SupabaseClient as ClienteTipado } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { listarHistorialTraslado } from "../../services/traslados";
import { listarHistorialAsignaciones } from "../../services/asignaciones";

// FASE 7 — Torre de Control: agregados operacionales.
// Sin migración: lee tablas existentes (traslados, operaciones, asignaciones,
// tracking_salud_traslado, alertas_sla_operacionales, empresas).
// Cliente sin genérico a propósito: los tipos generados están desfasados
// (deriva documentada en Fase 1); la autoridad es RLS en servidor.

type Cliente = SupabaseClient;

export interface FiltrosTorre {
  empresaId?: string | null;
  operacionId?: string | null;
  ciudad?: string | null;
  operativo?: string | null;
}

export interface KpisTorre {
  operacionesActivas: number;
  trasladosActivos: number;
  sinConductor: number;
  asignacionesRechazadas: number;
  conductoresSinSenal: number;
  trasladosRetrasados: number;
  slaEnRiesgo: number;
  slaVencido: number;
  incidenciasAbiertas: number;
  entregasProximas: number;
  evidenciasPendientes: number;
}

export interface ItemAtencion {
  trasladoId: string;
  estado: string;
  operativo: string;
  motivo: string;
  prioridad: number;
  conductorId: string | null;
  ciudadOrigen: string | null;
  operacionId: string | null;
  operacionFolio: string | null;
  actualizadoEn: string;
  horasEnEstado: number;
}

export interface EventoTimeline {
  fecha: string;
  tipo: "estado" | "asignacion";
  titulo: string;
  detalle: string | null;
}

export interface FiltrosDisponibles {
  empresas: Array<{ id: string; nombre: string }>;
  operaciones: Array<{ id: string; folio: string; nombre: string }>;
  ciudades: string[];
}

const ESTADOS_NO_ACTIVOS = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];
const ESTADOS_EVIDENCIA = [
  "verificacion_vehiculo_en_proceso",
  "evidencia_inicial_en_proceso",
  "evidencia_final_en_proceso"
];
const UMBRAL_SIN_SENAL_MIN = 30;
const VENTANA_ENTREGAS_MIN = 120;

type CualquierFila = Record<string, unknown>;

function tabla(cliente: Cliente, nombre: string) {
  return (cliente as unknown as { from: (t: string) => never }).from(nombre) as unknown as {
    select: (columnas: string, opciones?: { count?: "exact"; head?: boolean }) => never;
  };
}

interface QueryContador {
  in: (c: string, v: string[]) => QueryContador;
  eq: (c: string, v: string) => QueryContador;
}

interface QueryTraslados {
  not: (c: string, op: string, v: string) => QueryTraslados;
  eq: (c: string, v: string) => QueryTraslados;
  in: (c: string, v: string[]) => QueryTraslados;
  order: (c: string, o: { ascending: boolean }) => QueryTraslados;
  limit: (n: number) => Promise<{ data: CualquierFila[] | null; error: unknown }>;
}

async function trasladosBase(cliente: Cliente, filtros: FiltrosTorre): Promise<CualquierFila[]> {
  let usuarioIds: string[] | null = null;
  if (filtros.empresaId) {
    const { data, error } = (await (tabla(cliente, "usuarios").select("id") as unknown as {
      eq: (c: string, v: string) => Promise<{ data: Array<{ id: string }> | null; error: unknown }>;
    }).eq("empresa_id", filtros.empresaId)) as { data: Array<{ id: string }> | null; error: unknown };
    if (error) throw error;
    usuarioIds = (data ?? []).map((u) => u.id);
    if (usuarioIds.length === 0) return [];
  }

  let consulta = tabla(cliente, "traslados").select(
    "id,estado,estado_operativo,conductor_id,usuario_id,operation_id,tiene_incidencia_abierta,actualizado_en,creado_en,origen_ciudad,fecha_hora_programada,modalidad_programacion"
  ) as unknown as QueryTraslados;
  consulta = consulta.not("estado", "in", `(${ESTADOS_NO_ACTIVOS.join(",")})`);
  if (usuarioIds) consulta = consulta.in("usuario_id", usuarioIds);
  if (filtros.operacionId) consulta = consulta.eq("operation_id", filtros.operacionId);
  if (filtros.ciudad) consulta = consulta.eq("origen_ciudad", filtros.ciudad);
  if (filtros.operativo) consulta = consulta.eq("estado_operativo", filtros.operativo);
  const { data, error } = await consulta.order("actualizado_en", { ascending: false }).limit(500);
  if (error) throw error;
  return data ?? [];
}

function horasDesde(iso: string | null | undefined, ahora: number): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((ahora - t) / 3600000));
}

export async function obtenerKpisTorre(cliente: Cliente, filtros: FiltrosTorre = {}): Promise<KpisTorre> {
  const ahora = new Date();
  const limiteSenal = new Date(ahora.getTime() - UMBRAL_SIN_SENAL_MIN * 60000).toISOString();
  const limiteEntregas = new Date(ahora.getTime() + VENTANA_ENTREGAS_MIN * 60000).toISOString();

  const base = await trasladosBase(cliente, filtros);
  const ids = base.map((t) => String(t["id"]));
  const conConductor = base.filter((t) => t["conductor_id"]);

  const trasladosActivos = base.length;
  const sinConductor = base.filter((t) => !t["conductor_id"]).length;
  const incidenciasAbiertas = base.filter((t) => t["tiene_incidencia_abierta"]).length;
  const evidenciasPendientes = base.filter((t) => ESTADOS_EVIDENCIA.includes(String(t["estado"]))).length;
  const trasladosRetrasados = base.filter((t) => {
    const prog = t["fecha_hora_programada"] as string | null;
    if (!prog || Date.parse(prog) >= ahora.getTime()) return false;
    return String(t["estado"]) !== "entrega_confirmada";
  }).length;
  const entregasProximas = base.filter((t) => {
    const prog = t["fecha_hora_programada"] as string | null;
    if (!prog) return false;
    const ts = Date.parse(prog);
    return ts >= ahora.getTime() && ts <= Date.parse(limiteEntregas);
  }).length;

  let operacionesActivas = 0;
  {
    let q = tabla(cliente, "operaciones").select("id", { count: "exact", head: true }) as unknown as QueryContador;
    q = q.in("estado", ["planificada", "en_curso"]);
    if (filtros.empresaId) q = q.eq("empresa_id", filtros.empresaId);
    if (filtros.operacionId) q = q.eq("id", filtros.operacionId);
    const { count, error } = (await q) as unknown as { count: number | null; error: unknown };
    if (error) throw error;
    operacionesActivas = count ?? 0;
  }

  let asignacionesRechazadas = 0;
  if (ids.length > 0) {
    const { data, error } = (await (tabla(cliente, "asignaciones").select("traslado_id") as unknown as {
      eq: (c: string, v: string) => {
        in: (c: string, v: string[]) => Promise<{ data: Array<{ traslado_id: string }> | null; error: unknown }>;
      };
    })
      .eq("estado", "rechazada")
      .in("traslado_id", ids)) as { data: Array<{ traslado_id: string }> | null; error: unknown };
    if (error) throw error;
    const sinConductorIds = new Set(base.filter((t) => !t["conductor_id"]).map((t) => String(t["id"])));
    asignacionesRechazadas = (data ?? []).filter((r) => sinConductorIds.has(String(r["traslado_id"]))).length;
  }

  let conductoresSinSenal = 0;
  if (conConductor.length > 0) {
    const { data, error } = (await (tabla(cliente, "tracking_salud_traslado").select(
      "traslado_id,online,ultimo_envio_en"
    ) as unknown as {
      in: (c: string, v: string[]) => Promise<{
        data: Array<{ traslado_id: string; online: boolean | null; ultimo_envio_en: string | null }> | null;
        error: unknown;
      }>;
    }).in(
      "traslado_id",
      conConductor.map((t) => String(t["id"]))
    )) as {
      data: Array<{ traslado_id: string; online: boolean | null; ultimo_envio_en: string | null }> | null;
      error: unknown;
    };
    if (error) throw error;
    const conductores = new Set<string>();
    for (const t of conConductor) {
      const salud = (data ?? []).find((s) => String(s["traslado_id"]) === String(t["id"]));
      const sinSenal =
        !salud || salud.online === false || !salud.ultimo_envio_en || salud.ultimo_envio_en < limiteSenal;
      if (sinSenal && t["conductor_id"]) conductores.add(String(t["conductor_id"]));
    }
    conductoresSinSenal = conductores.size;
  }

  let slaEnRiesgo = 0;
  let slaVencido = 0;
  {
    const { data, error } = (await (tabla(cliente, "alertas_sla_operacionales").select(
      "traslado_id,categoria"
    ) as unknown as {
      in: (c: string, v: string[]) => {
        in: (c: string, v: string[]) => Promise<{
          data: Array<{ traslado_id: string | null; categoria: string }> | null;
          error: unknown;
        }>;
      };
    })
      .in("estado", ["abierta", "acusada", "escalada"])
      .in("categoria", ["sla_en_riesgo", "sla_vencido"])) as {
      data: Array<{ traslado_id: string | null; categoria: string }> | null;
      error: unknown;
    };
    if (error) throw error;
    const enBase = ids.length > 0 ? new Set(ids) : null;
    for (const a of data ?? []) {
      if (enBase && a["traslado_id"] && !enBase.has(String(a["traslado_id"]))) continue;
      if (a["categoria"] === "sla_vencido") slaVencido += 1;
      else slaEnRiesgo += 1;
    }
  }

  return {
    operacionesActivas,
    trasladosActivos,
    sinConductor,
    asignacionesRechazadas,
    conductoresSinSenal,
    trasladosRetrasados,
    slaEnRiesgo,
    slaVencido,
    incidenciasAbiertas,
    entregasProximas,
    evidenciasPendientes
  };
}

export interface ContextoAtencion {
  tracking: Map<string, { online: boolean | null; ultimoEnvioEn: string | null }>;
  slaPorTraslado: Map<string, "sla_vencido" | "sla_en_riesgo">;
  rechazadas: Set<string>;
  operaciones: Map<string, string>;
}

export function construirItemsAtencion(
  traslados: CualquierFila[],
  ctx: ContextoAtencion,
  ahoraMs = Date.now()
): ItemAtencion[] {
  const items: ItemAtencion[] = [];
  for (const t of traslados) {
    const id = String(t["id"]);
    const estado = String(t["estado"]);
    const operativo = String(t["estado_operativo"] ?? "");
    const horas = horasDesde(t["actualizado_en"] as string | null, ahoraMs);
    const candidatos: Array<{ motivo: string; prioridad: number }> = [];

    if (t["tiene_incidencia_abierta"]) {
      candidatos.push({ motivo: "Incidencia abierta: requiere intervención", prioridad: 100 });
    }
    const sla = ctx.slaPorTraslado.get(id);
    if (sla === "sla_vencido") candidatos.push({ motivo: "SLA vencido", prioridad: 90 });
    const prog = t["fecha_hora_programada"] as string | null;
    if (prog && Date.parse(prog) < ahoraMs && estado !== "entrega_confirmada") {
      candidatos.push({ motivo: "Retrasado sobre hora programada", prioridad: 80 });
    }
    if (!t["conductor_id"] && horas >= 24) {
      candidatos.push({ motivo: `Sin conductor desde hace ${horas} h`, prioridad: 75 });
    }
    if (operativo === "in_transit") {
      const salud = ctx.tracking.get(id);
      if (!salud || salud.online === false) {
        candidatos.push({ motivo: "En viaje sin señal GPS", prioridad: 70 });
      }
    }
    if (!t["conductor_id"] && ctx.rechazadas.has(id)) {
      candidatos.push({ motivo: "Asignación rechazada y sigue sin conductor", prioridad: 65 });
    }
    if (!t["conductor_id"]) {
      candidatos.push({ motivo: "Sin conductor asignado", prioridad: 60 });
    }
    if (ESTADOS_EVIDENCIA.includes(estado)) {
      candidatos.push({ motivo: "Evidencia pendiente de completar", prioridad: 55 });
    }
    if (sla === "sla_en_riesgo") candidatos.push({ motivo: "SLA en riesgo", prioridad: 50 });

    if (candidatos.length === 0) continue;
    candidatos.sort((a, b) => b.prioridad - a.prioridad);
    const top = candidatos[0];
    items.push({
      trasladoId: id,
      estado,
      operativo,
      motivo: top.motivo,
      prioridad: top.prioridad,
      conductorId: (t["conductor_id"] as string | null) ?? null,
      ciudadOrigen: (t["origen_ciudad"] as string | null) ?? null,
      operacionId: (t["operation_id"] as string | null) ?? null,
      operacionFolio: (t["operation_id"] as string | null)
        ? (ctx.operaciones.get(String(t["operation_id"])) ?? null)
        : null,
      actualizadoEn: String(t["actualizado_en"] ?? ""),
      horasEnEstado: horas
    });
  }
  items.sort((a, b) => b.prioridad - a.prioridad || b.horasEnEstado - a.horasEnEstado);
  return items;
}

export async function listarAtencionPrioritaria(
  cliente: Cliente,
  filtros: FiltrosTorre = {},
  limite = 50
): Promise<ItemAtencion[]> {
  const base = await trasladosBase(cliente, filtros);
  const ids = base.map((t) => String(t["id"]));
  const ctx: ContextoAtencion = {
    tracking: new Map(),
    slaPorTraslado: new Map(),
    rechazadas: new Set(),
    operaciones: new Map()
  };
  if (ids.length === 0) return [];

  const [tracking, sla, rechazadas, operaciones] = await Promise.all([
    (tabla(cliente, "tracking_salud_traslado").select("traslado_id,online,ultimo_envio_en") as unknown as {
      in: (c: string, v: string[]) => Promise<{ data: CualquierFila[] | null; error: unknown }>;
    }).in("traslado_id", ids),
    (tabla(cliente, "alertas_sla_operacionales").select("traslado_id,categoria") as unknown as {
      in: (c: string, v: string[]) => {
        in: (c: string, v: string[]) => Promise<{ data: CualquierFila[] | null; error: unknown }>;
      };
    })
      .in("estado", ["abierta", "acusada", "escalada"])
      .in("categoria", ["sla_en_riesgo", "sla_vencido"]),
    (tabla(cliente, "asignaciones").select("traslado_id") as unknown as {
      eq: (c: string, v: string) => {
        in: (c: string, v: string[]) => Promise<{ data: CualquierFila[] | null; error: unknown }>;
      };
    })
      .eq("estado", "rechazada")
      .in("traslado_id", ids),
    tabla(cliente, "operaciones").select("id,folio") as unknown as Promise<{
      data: CualquierFila[] | null;
      error: unknown;
    }>
  ]);
  if (tracking.error) throw tracking.error;
  if (sla.error) throw sla.error;
  if (rechazadas.error) throw rechazadas.error;
  if (operaciones.error) throw operaciones.error;

  for (const s of tracking.data ?? []) {
    ctx.tracking.set(String(s["traslado_id"]), {
      online: (s["online"] as boolean | null) ?? null,
      ultimoEnvioEn: (s["ultimo_envio_en"] as string | null) ?? null
    });
  }
  for (const a of sla.data ?? []) {
    if (a["traslado_id"] && ids.includes(String(a["traslado_id"]))) {
      ctx.slaPorTraslado.set(String(a["traslado_id"]), a["categoria"] as "sla_vencido" | "sla_en_riesgo");
    }
  }
  for (const r of rechazadas.data ?? []) ctx.rechazadas.add(String(r["traslado_id"]));
  for (const o of operaciones.data ?? []) ctx.operaciones.set(String(o["id"]), String(o["folio"]));

  return construirItemsAtencion(base, ctx).slice(0, limite);
}

export function ordenarTimeline(eventos: EventoTimeline[]): EventoTimeline[] {
  return [...eventos].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
}

export async function obtenerTimelineTraslado(cliente: Cliente, trasladoId: string): Promise<EventoTimeline[]> {
  const tipado = cliente as unknown as ClienteTipado<Database>;
  const [historial, asignaciones] = await Promise.all([
    listarHistorialTraslado(tipado, trasladoId),
    listarHistorialAsignaciones(tipado, trasladoId)
  ]);
  const eventos: EventoTimeline[] = [];
  for (const h of historial) {
    eventos.push({
      fecha: h.creado_en,
      tipo: "estado",
      titulo: `${h.estado_anterior} → ${h.estado_nuevo}`,
      detalle: [h.actor_tipo, h.motivo].filter(Boolean).join(" · ") || null
    });
  }
  for (const a of asignaciones) {
    eventos.push({
      fecha: a.creado_en,
      tipo: "asignacion",
      titulo: `Asignación ${a.estado}`,
      detalle: [a.conductor_id.slice(0, 8), a.motivo, a.origen].filter(Boolean).join(" · ") || null
    });
  }
  return ordenarTimeline(eventos);
}

export async function obtenerFiltrosTorre(cliente: Cliente): Promise<FiltrosDisponibles> {
  const [empresas, operaciones, traslados] = await Promise.all([
    tabla(cliente, "empresas").select("id,nombre") as unknown as Promise<{
      data: Array<{ id: string; nombre: string }> | null;
      error: unknown;
    }>,
    tabla(cliente, "operaciones").select("id,folio,nombre") as unknown as Promise<{
      data: Array<{ id: string; folio: string; nombre: string }> | null;
      error: unknown;
    }>,
    tabla(cliente, "traslados").select("origen_ciudad") as unknown as Promise<{
      data: Array<{ origen_ciudad: string | null }> | null;
      error: unknown;
    }>
  ]);
  if (empresas.error) throw empresas.error;
  if (operaciones.error) throw operaciones.error;
  if (traslados.error) throw traslados.error;
  const ciudades = [...new Set((traslados.data ?? []).map((t) => t.origen_ciudad).filter((c): c is string => !!c))].sort();
  return {
    empresas: (empresas.data ?? []).map((e) => ({ id: e.id, nombre: e.nombre })),
    operaciones: (operaciones.data ?? []).map((o) => ({ id: o.id, folio: o.folio, nombre: o.nombre })),
    ciudades
  };
}
