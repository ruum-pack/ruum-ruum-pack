import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { TRANSICIONES } from "@ruum/shared/states";

type Cliente = SupabaseClient<Database>;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type TipoPago = Database["public"]["Enums"]["tipo_pago"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface DatosNuevoTraslado {
  usuario_id: string;
  vehiculo_id: string;
  contacto_entrega_nombre: string;
  contacto_entrega_telefono: string;
  contacto_recepcion_nombre: string;
  contacto_recepcion_telefono: string;
  origen_lat: number;
  origen_lng: number;
  origen_direccion: string;
  origen_ciudad: string;
  destino_lat: number;
  destino_lng: number;
  destino_direccion: string;
  destino_ciudad: string;
  origen_referencias?: string | null;
  destino_referencias?: string | null;
  instrucciones_especiales?: string | null;
  modalidad_programacion?: string | null;
  fecha_hora_programada?: string | null;
  tipo_ruta?: string | null;
  ventana_recoleccion?: string | null;
  ventana_entrega?: string | null;
  tipo_servicio?: string | null;
  motivo_servicio?: string | null;
  precio_cotizado: number;
  tipo_pago: TipoPago;
}

/** PRD §4.1 — crea la solicitud de traslado (estado inicial: solicitud_creada). */
export async function crearTraslado(cliente: Cliente, datos: DatosNuevoTraslado) {
  const { data, error } = await cliente
    .from("traslados")
    .insert({ ...datos, estado: "solicitud_creada" })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

/** PRD §5.1 — el Pasaporte Digital de Traslado completo, para la pantalla de seguimiento. */
export async function obtenerPasaporteDigital(cliente: Cliente, trasladoId: string): Promise<PasaporteRow | null> {
  const { data, error } = await cliente
    .from("pasaporte_digital")
    .select("*")
    .eq("traslado_id", trasladoId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Lista los traslados de un usuario, más recientes primero (para el dashboard). */
export async function listarTrasladosDeUsuario(cliente: Cliente, usuarioId: string): Promise<PasaporteRow[]> {
  const { data, error } = await cliente
    .from("pasaporte_digital")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * PRD §16.3 — Pestaña 1 "Viajes solicitados": viajes ofertados/disponibles
 * para aceptación. Visibilidad mínima por RLS (sección
 * conductor_ve_viajes_disponibles, migración 0018); el filtro de
 * ELEGIBILIDAD real (nivel CONCER, tipo de vehículo, ruta) es responsabilidad
 * de la app, vía rules/elegibilidad-conductor.ts — esta función solo trae
 * los candidatos visibles, no decide quién puede aceptarlos.
 */
export async function listarViajesDisponibles(cliente: Cliente): Promise<PasaporteRow[]> {
  const { data, error } = await cliente
    .from("pasaporte_digital")
    .select("*")
    .eq("estado", "pendiente_de_conductor")
    .order("creado_en", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** PRD §16.3 — Pestaña 2 "Viajes aceptados": los que ya tiene este conductor. */
export async function listarViajesAceptados(cliente: Cliente, conductorId: string): Promise<PasaporteRow[]> {
  const { data, error } = await cliente
    .from("pasaporte_digital")
    .select("*")
    .eq("conductor_id", conductorId)
    .not("estado", "in", "(servicio_cerrado,servicio_cancelado,traslado_fallido)")
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * PRD §16.3 — botón "aceptar" sobre un viaje disponible. Transición
 * pendiente_de_conductor -> conductor_asignado (ver TRANSICIONES, único
 * salto válido desde ese estado además de servicio_cancelado, que no
 * corresponde a una acción del conductor).
 */
export async function aceptarViaje(cliente: Cliente, trasladoId: string, conductorId: string) {
  const { error } = await cliente
    .from("traslados")
    .update({ estado: "conductor_asignado", conductor_id: conductorId })
    .eq("id", trasladoId)
    .eq("estado", "pendiente_de_conductor");

  if (error) throw error;
}

/**
 * Avanza el traslado al siguiente paso del camino feliz (primer elemento de
 * TRANSICIONES[estadoActual] — mismo mapa que valida el trigger de Postgres
 * en 0005, así que un intento inválido se rechaza ahí aunque esta función
 * tenga un bug). No se usa para los pasos que requieren evidencia completa
 * (verificacion_vehiculo_en_proceso, evidencia_inicial_en_proceso,
 * llegada_a_destino, evidencia_final_en_proceso): esos viven en
 * services/evidencia.ts porque están condicionados a
 * evidenciaCompleta() (PRD §4.4), no son un simple "siguiente paso".
 */
export async function avanzarEstadoTraslado(cliente: Cliente, trasladoId: string, estadoActual: EstadoTraslado) {
  const siguiente = TRANSICIONES[estadoActual]?.[0];
  if (!siguiente) {
    throw new Error(`No hay siguiente paso del camino feliz desde ${estadoActual}`);
  }

  const { error } = await cliente
    .from("traslados")
    .update({ estado: siguiente })
    .eq("id", trasladoId)
    .eq("estado", estadoActual);

  if (error) throw error;
  return siguiente;
}
