import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

// FASE 6 (cierre) — Lecturas del pasaporte de traslado para usuario y
// conductor. Sustituyen los `.from()` directos en
// app-usuario/.../traslados/[id]/page.tsx y el detalle por ids en
// app-conductor/.../viajes/page.tsx. Son tolerantes: ante error devuelven
// null/[] (la UI decide el fallback), nunca lanzan por datos.

type Cliente = SupabaseClient<Database>;
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type VehiculoRow = Database["public"]["Tables"]["vehiculos"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type FotoRow = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
type IncidenciaRow = Database["public"]["Tables"]["incidencias"]["Row"];
type DisputaRow = Database["public"]["Tables"]["disputas"]["Row"];
type ReclamoRow = Database["public"]["Tables"]["reclamos_seguro"]["Row"];
type CalificacionRow = Database["public"]["Tables"]["calificaciones_traslado"]["Row"];
type PagoRow = Database["public"]["Tables"]["pagos"]["Row"];

export type ResumenTraslado = Pick<
  TrasladoRow,
  | "origen_direccion"
  | "origen_ciudad"
  | "destino_direccion"
  | "destino_ciudad"
  | "contacto_entrega_nombre"
  | "contacto_entrega_telefono"
  | "contacto_recepcion_nombre"
  | "contacto_recepcion_telefono"
  | "fecha_hora_programada"
  | "cotizacion_expira_en"
>;

export type VehiculoTraslado = Pick<
  VehiculoRow,
  | "tipo"
  | "marca"
  | "modelo"
  | "anio"
  | "tiene_tarjeta_circulacion"
  | "tiene_verificacion"
  | "tiene_placas"
  | "puede_circular_rodando"
>;

export type ConductorTraslado = Pick<
  ConductorRow,
  "id" | "nombre" | "estado" | "nivel_operativo_vigente" | "calificacion_promedio" | "traslados_completados"
>;

export type ReclamoTraslado = Pick<
  ReclamoRow,
  "id" | "traslado_id" | "estado" | "abierto_en" | "resuelto_en"
>;

export type DetalleTrasladoConductor = Pick<
  TrasladoRow,
  | "id"
  | "origen_ciudad"
  | "origen_direccion"
  | "destino_ciudad"
  | "destino_direccion"
  | "fecha_hora_programada"
  | "tipo_servicio"
  | "motivo_servicio"
  | "instrucciones_especiales"
>;

async function uno<T>(promesa: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const res = await promesa;
    if (res.error) return null;
    return res.data ?? null;
  } catch {
    return null;
  }
}

async function varios<T>(promesa: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const res = await promesa;
    if (res.error) return [];
    return res.data ?? [];
  } catch {
    return [];
  }
}

export function obtenerResumenTraslado(cliente: Cliente, trasladoId: string): Promise<ResumenTraslado | null> {
  return uno(
    cliente
      .from("traslados")
      .select(
        "origen_direccion, origen_ciudad, destino_direccion, destino_ciudad, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, fecha_hora_programada, cotizacion_expira_en"
      )
      .eq("id", trasladoId)
      .maybeSingle()
  );
}

export function obtenerVehiculoTraslado(
  cliente: Cliente,
  vehiculoId: string | null
): Promise<VehiculoTraslado | null> {
  if (!vehiculoId) return Promise.resolve(null);
  return uno(
    cliente
      .from("vehiculos")
      .select(
        "tipo, marca, modelo, anio, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando"
      )
      .eq("id", vehiculoId)
      .maybeSingle()
  );
}

export function obtenerConductorTraslado(
  cliente: Cliente,
  conductorId: string | null
): Promise<ConductorTraslado | null> {
  if (!conductorId) return Promise.resolve(null);
  return uno(
    cliente
      .from("conductores")
      .select("id, nombre, estado, nivel_operativo_vigente, calificacion_promedio, traslados_completados")
      .eq("id", conductorId)
      .maybeSingle()
  );
}

export function listarFotosEvidencia(cliente: Cliente, trasladoId: string): Promise<FotoRow[]> {
  return varios(
    cliente
      .from("evidencia_fotos")
      .select("*")
      .eq("traslado_id", trasladoId)
      .order("capturada_en", { ascending: true })
  );
}

export function listarIncidenciasTraslado(cliente: Cliente, trasladoId: string): Promise<IncidenciaRow[]> {
  return varios(
    cliente.from("incidencias").select("*").eq("traslado_id", trasladoId).order("creada_en", { ascending: false })
  );
}

export function listarDisputasTraslado(cliente: Cliente, trasladoId: string): Promise<DisputaRow[]> {
  return varios(
    cliente.from("disputas").select("*").eq("traslado_id", trasladoId).order("abierta_en", { ascending: false })
  );
}

export function listarReclamosTraslado(cliente: Cliente, trasladoId: string): Promise<ReclamoTraslado[]> {
  return varios(
    cliente
      .from("reclamos_seguro")
      .select("id, traslado_id, estado, abierto_en, resuelto_en")
      .eq("traslado_id", trasladoId)
      .order("abierto_en", { ascending: false })
  );
}

export function obtenerCalificacionTraslado(cliente: Cliente, trasladoId: string): Promise<CalificacionRow | null> {
  return uno(
    cliente.from("calificaciones_traslado").select("*").eq("traslado_id", trasladoId).maybeSingle()
  );
}

export function listarPagosTraslado(cliente: Cliente, trasladoId: string): Promise<PagoRow[]> {
  return varios(
    cliente.from("pagos").select("*").eq("traslado_id", trasladoId).order("registrado_en", { ascending: false })
  );
}

export function obtenerTrasladosPorIds(
  cliente: Cliente,
  trasladoIds: string[]
): Promise<DetalleTrasladoConductor[]> {
  if (trasladoIds.length === 0) return Promise.resolve([]);
  return varios(
    cliente
      .from("traslados")
      .select(
        "id, origen_ciudad, origen_direccion, destino_ciudad, destino_direccion, fecha_hora_programada, tipo_servicio, motivo_servicio, instrucciones_especiales"
      )
      .in("id", trasladoIds)
  );
}

export interface TrasladoConRelaciones {
  traslado: TrasladoRow | null;
  vehiculo: VehiculoRow | null;
  conductor: ConductorRow | null;
}

/** Fallback resiliente cuando la vista pasaporte_digital no devuelve fila. */
export async function obtenerTrasladoConRelaciones(
  cliente: Cliente,
  trasladoId: string
): Promise<TrasladoConRelaciones> {
  const vacio: TrasladoConRelaciones = { traslado: null, vehiculo: null, conductor: null };
  try {
    const res = await cliente
      .from("traslados")
      .select("*, vehiculos (*), conductores (*)")
      .eq("id", trasladoId)
      .maybeSingle();
    if (res.error || !res.data) return vacio;
    const fila = res.data as TrasladoRow & {
      vehiculos: VehiculoRow | null;
      conductores: ConductorRow | null;
    };
    const { vehiculos, conductores, ...traslado } = fila;
    return { traslado, vehiculo: vehiculos ?? null, conductor: conductores ?? null };
  } catch {
    return vacio;
  }
}
