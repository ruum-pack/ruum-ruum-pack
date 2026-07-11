import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conductor, Database } from "@ruum/shared/types";
import { TRANSICIONES } from "@ruum/shared/states";
import { esElegibleParaViaje, type TipoRuta } from "@ruum/shared/rules";
import { calcularCargoCancelacion } from "@ruum/shared/rules";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type TipoPago = Database["public"]["Enums"]["tipo_pago"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type EventoConductorTraslado =
  | "conductor_en_camino"
  | "llegada_origen"
  | "iniciar_verificacion"
  | "iniciar_evidencia_inicial"
  | "vehiculo_recibido"
  | "iniciar_traslado"
  | "llegada_destino"
  | "iniciar_evidencia_final"
  | "confirmar_entrega";

async function obtenerUsuarioIdActual(cliente: Cliente): Promise<string> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) {
    throw new Error("No hay sesión de usuario para registrar la acción.");
  }

  const { data, error } = await cliente.from("usuarios").select("id").eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No se encontró el usuario autenticado.");
  return data.id;
}

export interface DatosNuevoTraslado {
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

export interface DatosVehiculoNuevo {
  tipo: Database["public"]["Enums"]["tipo_vehiculo"];
  transmision: "manual" | "automatica" | "electrica";
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  placas: string;
  vin: string;
  estado_general_declarado: string;
  tiene_tarjeta_circulacion: boolean;
  tiene_verificacion: boolean;
  tiene_placas: boolean;
  puede_circular_rodando: boolean;
}

export type DatosVehiculoParaTraslado = { vehiculoId: string } | { vehiculo: DatosVehiculoNuevo };

/**
 * PRD §4.1 — crea la solicitud de traslado (estado inicial: solicitud_creada).
 *
 * Desde la migración 20260711000118 esto es una sola RPC transaccional
 * (usuario_crea_traslado) en vez de dos inserts sueltos desde el cliente:
 * evita el vehículo huérfano si el insert del traslado fallaba después del
 * de vehículo, y valida en la base que un vehiculoId reutilizado sea del
 * usuario autenticado (antes solo se filtraba por RLS de SELECT al listarlo,
 * pero nada impedía mandar un UUID ajeno directo al insert de traslados).
 */
export async function crearTraslado(cliente: Cliente, vehiculo: DatosVehiculoParaTraslado, traslado: DatosNuevoTraslado) {
  const { data, error } = await cliente.rpc("usuario_crea_traslado", {
    p_vehiculo_id: "vehiculoId" in vehiculo ? vehiculo.vehiculoId : null,
    p_vehiculo: ("vehiculo" in vehiculo ? vehiculo.vehiculo : null) as never,
    p_traslado: traslado as never
  });

  if (error) throw error;
  return { id: data as string };
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

/** PRD §4.1 — historial empresarial visible para el titular de la empresa. */
export async function listarTrasladosDeEmpresa(cliente: Cliente, empresaId: string): Promise<PasaporteRow[]> {
  const { data: titular, error: errorTitular } = await cliente
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("rol", "titular_empresa")
    .maybeSingle();

  if (errorTitular) throw errorTitular;
  if (!titular) {
    throw new Error("Solo el titular de la empresa puede consultar este historial.");
  }

  const { data: traslados, error: errorTraslados } = await cliente
    .from("traslados")
    .select("id, creado_en")
    .order("creado_en", { ascending: false });

  if (errorTraslados) throw errorTraslados;

  const ids = (traslados ?? []).map((traslado) => traslado.id);
  if (ids.length === 0) return [];

  const { data, error } = await cliente
    .from("pasaporte_digital")
    .select("*")
    .in("traslado_id", ids)
    .order("creado_en", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * PRD §16.3 — Pestaña 1 "Viajes solicitados": viajes ofertados/disponibles
 * para aceptación. Visibilidad mínima por RLS (migración 0018). Esta lista
 * puede traer candidatos visibles; la aceptación se revalida en aceptarViaje()
 * con esElegibleParaViaje() antes de tocar el traslado.
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

function tipoRutaParaElegibilidad(tipoRuta: TrasladoRow["tipo_ruta"]): TipoRuta {
  if (tipoRuta === "foraneo") return "interurbana_mas_100km";
  if (tipoRuta === "local" || tipoRuta === null) return "intraurbana";
  throw new Error(`Tipo de ruta no soportado para elegibilidad: ${tipoRuta}`);
}

async function validarElegibilidadAceptacion(cliente: Cliente, trasladoId: string, conductorId: string) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Inicia sesión como conductor para aceptar viajes.");

  const [{ data: conductor, error: errorConductor }, { data: traslado, error: errorTraslado }, pasaporte] = await Promise.all([
    cliente.from("conductores").select("*").eq("id", conductorId).eq("auth_user_id", sesion.user.id).maybeSingle(),
    cliente.from("traslados").select("*").eq("id", trasladoId).maybeSingle(),
    obtenerPasaporteDigital(cliente, trasladoId)
  ]);

  if (errorConductor) throw errorConductor;
  if (errorTraslado) throw errorTraslado;
  if (!conductor) throw new Error("No se encontró el conductor para validar elegibilidad.");
  if (!traslado) throw new Error("No se encontró el traslado para validar elegibilidad.");
  if (traslado.estado !== "pendiente_de_conductor" || traslado.conductor_id !== null) {
    throw new Error("El viaje ya no está disponible para aceptación.");
  }
  if (!pasaporte?.vehiculo_tipo) {
    throw new Error("No se pudo validar elegibilidad: el viaje no tiene tipo de vehículo.");
  }

  const resultado = esElegibleParaViaje(aConductorRegla(conductor), pasaporte.vehiculo_tipo, tipoRutaParaElegibilidad(traslado.tipo_ruta));
  if (!resultado.elegible) {
    throw new Error(`Conductor no elegible para este viaje: ${resultado.motivo ?? "no cumple los requisitos"}`);
  }
}

/**
 * PRD §16.3 — botón "aceptar" sobre un viaje disponible. Transición
 * pendiente_de_conductor -> conductor_asignado (ver TRANSICIONES, único
 * salto válido desde ese estado además de servicio_cancelado, que no
 * corresponde a una acción del conductor).
 */
export async function aceptarViaje(cliente: Cliente, trasladoId: string, conductorId: string) {
  await validarElegibilidadAceptacion(cliente, trasladoId, conductorId);

  const { error } = await cliente.rpc("conductor_acepta_viaje", { p_traslado_id: trasladoId });

  if (error) {
    throw new Error(error.message || "El viaje ya no está disponible para aceptación.");
  }
}

function horasRestantes(fechaIso: string | null) {
  if (!fechaIso) return Number.POSITIVE_INFINITY;
  return Math.max(0, (new Date(fechaIso).getTime() - Date.now()) / (1000 * 60 * 60));
}

/**
 * Estados desde los que el usuario puede cancelar su traslado (decisión de
 * producto 2026-07-09: hasta que el conductor llega al punto de recolección;
 * después ya no es cancelación sino disputa o traslado fallido).
 *
 * Es el mismo conjunto que la tabla `estado_transiciones_validas` habilita
 * hacia `servicio_cancelado` (ver migración 0005) y que la RPC
 * `usuario_cancela_traslado` revalida en la base (migración 0051). Se
 * duplica aquí a propósito, como defensa en profundidad, para dar un mensaje
 * claro en la UI sin ida y vuelta a Postgres; la base sigue siendo la fuente
 * de verdad que rechaza cualquier estado fuera de esta lista.
 */
const ESTADOS_CANCELABLES_POR_USUARIO: EstadoTraslado[] = [
  "solicitud_creada",
  "documentacion_pendiente",
  "documentacion_en_revision",
  "cotizacion_generada",
  "servicio_confirmado",
  "pendiente_de_conductor",
  "conductor_asignado",
  "conductor_en_punto_de_recoleccion"
];

export function usuarioPuedeCancelar(estado: EstadoTraslado): boolean {
  return ESTADOS_CANCELABLES_POR_USUARIO.includes(estado);
}

export async function cancelarTraslado(cliente: Cliente, trasladoId: string, motivo: string) {
  const { data: traslado, error } = await cliente
    .from("traslados")
    .select("id, estado, conductor_id, fecha_hora_programada, precio_cotizado, precio_final")
    .eq("id", trasladoId)
    .maybeSingle();

  if (error) throw error;
  if (!traslado) throw new Error("No se encontró el traslado para cancelar.");

  if (!usuarioPuedeCancelar(traslado.estado)) {
    throw new Error(
      "Este traslado ya no puede cancelarse: el vehículo ya está en verificación o en tránsito. Abre una disputa o reporta una incidencia."
    );
  }

  const cargo = calcularCargoCancelacion(
    Number(traslado.precio_final ?? traslado.precio_cotizado ?? 0),
    horasRestantes(traslado.fecha_hora_programada),
    Boolean(traslado.conductor_id),
    // El cargo del 100% aplica cuando el conductor ya llegó al punto de
    // recolección. Los estados posteriores (verificación/evidencia) ya no son
    // cancelables, así que no forman parte de este flag.
    traslado.estado === "conductor_en_punto_de_recoleccion"
  );

  const { error: rpcError } = await cliente.rpc("usuario_cancela_traslado", {
    p_traslado_id: trasladoId,
    p_motivo: motivo.trim() || "Cancelación solicitada por usuario",
    p_porcentaje_cargo: cargo.porcentaje_cargo,
    p_monto_cargo: cargo.monto_cargo,
    p_mensaje: cargo.mensaje
  });

  if (rpcError) throw rpcError;
  return cargo;
}

export async function crearCalificacion(
  cliente: Cliente,
  trasladoId: string,
  conductorId: string,
  estrellas: number,
  comentario?: string | null
) {
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    throw new Error("La calificación debe estar entre 1 y 5 estrellas.");
  }

  const { data: traslado, error: errorTraslado } = await cliente
    .from("traslados")
    .select("id, estado, actualizado_en")
    .eq("id", trasladoId)
    .maybeSingle();

  if (errorTraslado) throw errorTraslado;
  if (!traslado) throw new Error("No se encontró el traslado a calificar.");
  if (traslado.estado !== "servicio_cerrado") {
    throw new Error("Solo se puede calificar un traslado finalizado.");
  }

  const horasDesdeCierre = (Date.now() - new Date(traslado.actualizado_en).getTime()) / (1000 * 60 * 60);
  if (horasDesdeCierre > 72) {
    throw new Error("El plazo de 72 horas para calificar este traslado ya venció.");
  }

  const { error } = await cliente.from("calificaciones_traslado").insert({
    traslado_id: trasladoId,
    conductor_id: conductorId,
    estrellas,
    comentario: comentario?.trim() || null
  });

  if (error) throw error;

  const usuarioId = await obtenerUsuarioIdActual(cliente);
  await registrarEvento(cliente, "calificacion_conductor", "usuario", usuarioId, {
    traslado_id: trasladoId,
    conductor_id: conductorId,
    estrellas
  });
}

const EVENTO_CONDUCTOR_POR_ESTADO: Partial<Record<EstadoTraslado, EventoConductorTraslado>> = {
  conductor_asignado: "conductor_en_camino",
  conductor_en_camino_al_origen: "llegada_origen",
  conductor_en_punto_de_recoleccion: "iniciar_verificacion",
  verificacion_vehiculo_en_proceso: "iniciar_evidencia_inicial",
  evidencia_inicial_completada: "vehiculo_recibido",
  vehiculo_recibido: "iniciar_traslado",
  traslado_en_curso: "llegada_destino",
  llegada_a_destino: "iniciar_evidencia_final",
  evidencia_final_completada: "confirmar_entrega"
};

/**
 * Avanza el traslado al siguiente paso del camino feliz (primer elemento de
 * TRANSICIONES[estadoActual]), pero sin UPDATE directo sobre traslados desde
 * el cliente conductor. La RPC security definer valida que el conductor
 * autenticado esté asignado, actualiza solo `estado` y escribe auditoría.
 * No se usa para completar evidencia: esos pasos viven en services/evidencia.ts
 * porque primero revalidan evidenciaCompleta() en aplicación y luego pasan por
 * la misma RPC dedicada.
 */
export async function avanzarEstadoTraslado(cliente: Cliente, trasladoId: string, estadoActual: EstadoTraslado) {
  const siguiente = TRANSICIONES[estadoActual]?.[0];
  if (!siguiente) {
    throw new Error(`No hay siguiente paso del camino feliz desde ${estadoActual}`);
  }

  const evento = EVENTO_CONDUCTOR_POR_ESTADO[estadoActual];
  if (!evento) {
    throw new Error(`El estado ${estadoActual} no corresponde a un evento directo del conductor`);
  }

  const { data, error } = await cliente.rpc("conductor_avanza_traslado", {
    p_traslado_id: trasladoId,
    p_evento: evento
  });

  if (error) throw error;
  return data ?? siguiente;
}