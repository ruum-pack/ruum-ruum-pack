import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

type TarifaVehiculoRow = Database["public"]["Tables"]["tarifas_vehiculo"]["Row"];
type TarifaGamaRow = Database["public"]["Tables"]["tarifas_gama"]["Row"];
type TarifaCondicionRow = Database["public"]["Tables"]["tarifas_condicion"]["Row"];
type TarifaHorarioRow = Database["public"]["Tables"]["tarifas_horario"]["Row"];
type TarifaDiaRow = Database["public"]["Tables"]["tarifas_dia"]["Row"];
type TarifaConfigRow = Database["public"]["Tables"]["tarifas_config"]["Row"];
type CertificacionPagoRow = Database["public"]["Tables"]["certificacion_pago_conductor"]["Row"];
type AdminRow = Database["public"]["Tables"]["admins"]["Row"];

export interface ConfiguracionTarifas {
  vehiculo: TarifaVehiculoRow[];
  gama: TarifaGamaRow[];
  condicion: TarifaCondicionRow[];
  horario: TarifaHorarioRow[];
  dia: TarifaDiaRow[];
  config: TarifaConfigRow | null;
  certificacionPago: CertificacionPagoRow[];
  adminActualizacion: Pick<AdminRow, "id" | "nombre"> | null;
}

/**
 * Lee la configuración completa de la fórmula de tarifas (RT-12). Todas las
 * tablas están vedadas por RLS a cualquier rol que no sea admin -- si el
 * llamador no es admin, Supabase simplemente devuelve filas vacías, no un
 * error, así que el panel debe tratar "vacío" como señal de acceso denegado
 * o configuración sin sembrar.
 */
export async function obtenerConfiguracionTarifas(cliente: Cliente): Promise<ConfiguracionTarifas> {
  const [vehiculo, gama, condicion, horario, dia, config, certificacionPago] = await Promise.all([
    cliente.from("tarifas_vehiculo").select("*").order("categoria").order("rango"),
    cliente.from("tarifas_gama").select("*").order("gama"),
    cliente.from("tarifas_condicion").select("*").order("condicion"),
    cliente.from("tarifas_horario").select("*").order("horario"),
    cliente.from("tarifas_dia").select("*").order("dia"),
    cliente.from("tarifas_config").select("*").maybeSingle(),
    cliente.from("certificacion_pago_conductor").select("*").order("certificacion")
  ]);

  for (const r of [vehiculo, gama, condicion, horario, dia, config, certificacionPago]) {
    if (r.error) throw r.error;
  }

  let adminActualizacion: Pick<AdminRow, "id" | "nombre"> | null = null;
  const adminId = config.data?.actualizado_por_admin_id;
  if (adminId) {
    const { data, error } = await cliente.from("admins").select("id,nombre").eq("id", adminId).maybeSingle();
    if (error) throw error;
    adminActualizacion = data;
  }

  return {
    vehiculo: vehiculo.data ?? [],
    gama: gama.data ?? [],
    condicion: condicion.data ?? [],
    horario: horario.data ?? [],
    dia: dia.data ?? [],
    config: config.data,
    certificacionPago: certificacionPago.data ?? [],
    adminActualizacion
  };
}

async function idAdminActual(cliente: Cliente): Promise<string | null> {
  const sesion = await cliente.auth.getUser();
  if (!sesion.data.user) return null;
  const { data } = await cliente.from("admins").select("id").eq("auth_user_id", sesion.data.user.id).maybeSingle();
  return data?.id ?? null;
}

export async function actualizarTarifaVehiculo(
  cliente: Cliente,
  id: string,
  cambios: { base: number; por_km: number }
) {
  if (cambios.base < 0 || cambios.por_km < 0) throw new Error("Base y $/km deben ser mayores o iguales a 0.");
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente
    .from("tarifas_vehiculo")
    .update({ ...cambios, actualizado_por_admin_id: adminId })
    .eq("id", id);
  if (error) throw error;
}

export async function actualizarFactorGama(cliente: Cliente, gama: TarifaGamaRow["gama"], factor: number) {
  if (factor <= 0) throw new Error("El factor debe ser mayor a 0.");
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente
    .from("tarifas_gama")
    .update({ factor, actualizado_por_admin_id: adminId })
    .eq("gama", gama);
  if (error) throw error;
}

export async function actualizarFactorCondicion(
  cliente: Cliente,
  condicion: TarifaCondicionRow["condicion"],
  factor: number
) {
  if (factor <= 0) throw new Error("El factor debe ser mayor a 0.");
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente
    .from("tarifas_condicion")
    .update({ factor, actualizado_por_admin_id: adminId })
    .eq("condicion", condicion);
  if (error) throw error;
}

export async function actualizarFactorHorario(cliente: Cliente, horario: TarifaHorarioRow["horario"], factor: number) {
  if (factor <= 0) throw new Error("El factor debe ser mayor a 0.");
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente
    .from("tarifas_horario")
    .update({ factor, actualizado_por_admin_id: adminId })
    .eq("horario", horario);
  if (error) throw error;
}

export async function actualizarFactorDia(cliente: Cliente, dia: TarifaDiaRow["dia"], factor: number) {
  if (factor <= 0) throw new Error("El factor debe ser mayor a 0.");
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente.from("tarifas_dia").update({ factor, actualizado_por_admin_id: adminId }).eq("dia", dia);
  if (error) throw error;
}

export async function actualizarConfigTarifas(
  cliente: Cliente,
  cambios: {
    tarifa_hora: number;
    tope_factor_variable: number;
    nombre_version?: string;
    estado?: TarifaConfigRow["estado"];
    vigente_desde?: string;
    notas?: string | null;
  }
) {
  if (cambios.tarifa_hora < 0) throw new Error("La tarifa por hora debe ser mayor o igual a 0.");
  if (cambios.tope_factor_variable < 1) throw new Error("El tope del factor variable debe ser mayor o igual a 1.");
  if (cambios.nombre_version !== undefined && !cambios.nombre_version.trim()) {
    throw new Error("El nombre de la versión no puede quedar vacío.");
  }
  if (cambios.vigente_desde !== undefined && Number.isNaN(Date.parse(cambios.vigente_desde))) {
    throw new Error("La fecha de vigencia no es válida.");
  }
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente
    .from("tarifas_config")
    .update({ ...cambios, actualizado_por_admin_id: adminId })
    .eq("id", true);
  if (error) throw error;
}

export async function actualizarPagoConductorPorCertificacion(
  cliente: Cliente,
  certificacion: CertificacionPagoRow["certificacion"],
  porcentaje: number
) {
  if (porcentaje < 0 || porcentaje > 100) throw new Error("El porcentaje debe estar entre 0 y 100.");
  const adminId = await idAdminActual(cliente);
  const { error } = await cliente
    .from("certificacion_pago_conductor")
    .update({ porcentaje, actualizado_por_admin_id: adminId })
    .eq("certificacion", certificacion);
  if (error) throw error;
}

/**
 * Torre de Control clasifica el vehículo del traslado para efectos de tarifa
 * (categoría de peso/complejidad, gama, condición). Deliberadamente NO la
 * escribe el usuario en su formulario -- si pudiera, se autoasignaría
 * siempre la categoría más barata.
 */
export async function clasificarVehiculoParaTarifa(
  cliente: Cliente,
  vehiculoId: string,
  clasificacion: {
    categoria_tarifa: Database["public"]["Enums"]["categoria_tarifa_vehiculo"];
    gama: Database["public"]["Enums"]["gama_vehiculo"];
    condicion: Database["public"]["Enums"]["condicion_vehiculo"];
  }
) {
  const { error } = await cliente.from("vehiculos").update(clasificacion).eq("id", vehiculoId);
  if (error) throw error;
}

/**
 * Guarda la distancia y tiempo estimado (calculados vía Mapbox Directions en
 * el cliente) sobre un traslado ya existente -- paso previo a poder llamar
 * admin_sugerir_tarifa_traslado, que los requiere.
 */
export async function guardarDistanciaYTiempoTraslado(
  cliente: Cliente,
  trasladoId: string,
  cambios: { distancia_km: number; tiempo_estimado_horas: number }
) {
  if (cambios.distancia_km < 0 || cambios.tiempo_estimado_horas < 0) {
    throw new Error("Distancia y tiempo deben ser mayores o iguales a 0.");
  }
  const { error } = await cliente.from("traslados").update(cambios).eq("id", trasladoId);
  if (error) throw error;
}

export interface PrevisualizacionTarifa {
  disponible: boolean;
  motivo?: string;
  tarifa?: number;
  categoria_tarifa?: Database["public"]["Enums"]["categoria_tarifa_vehiculo"];
  gama?: Database["public"]["Enums"]["gama_vehiculo"];
  condicion?: Database["public"]["Enums"]["condicion_vehiculo"];
  horario?: Database["public"]["Enums"]["horario_traslado"];
  dia?: Database["public"]["Enums"]["dia_traslado"];
}

/**
 * Previsualiza la tarifa (RT-13) que se le mostrará al usuario, sin crear el
 * traslado todavía. Se usa en el último paso del wizard de app-usuario, una
 * vez que ya se capturaron marca/modelo, distancia/tiempo (Mapbox) y fecha/hora
 * -- el usuario nunca escribe un presupuesto, solo lee este número.
 *
 * `disponible: false` significa que el vehículo no está en el catálogo de
 * autoclasificación (marca/modelo desconocidos o ambiguos); en ese caso no
 * hay número que mostrar todavía y la solicitud, al crearse, quedará
 * pendiente de cotización manual por Torre de Control.
 */
export async function previsualizarTarifaUsuario(
  cliente: Cliente,
  datos: {
    marca: string;
    modelo: string;
    distanciaKm: number;
    tiempoEstimadoHoras: number;
    fechaHora: Date | null;
    condicion?: Database["public"]["Enums"]["condicion_vehiculo"];
  }
): Promise<PrevisualizacionTarifa> {
  const { data, error } = await cliente.rpc("usuario_previsualizar_tarifa", {
    p_marca: datos.marca,
    p_modelo: datos.modelo,
    p_distancia_km: datos.distanciaKm,
    p_tiempo_estimado_horas: datos.tiempoEstimadoHoras,
    p_fecha_hora: datos.fechaHora ? datos.fechaHora.toISOString() : null,
    p_condicion: datos.condicion ?? "seminueva"
  });
  if (error) throw error;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("La previsualización de tarifa no devolvió un objeto válido.");
  }

  return data as unknown as PrevisualizacionTarifa;
}

/**
 * Sugerencia de tarifa (RT-12) para un traslado ya existente, calculada en
 * el servidor con la fórmula vigente. No escribe precio_cotizado -- el admin
 * sigue confirmando explícitamente vía emitirCotizacionAdmin, pudiendo usar
 * este número tal cual o ajustarlo.
 */
export async function sugerirTarifaTraslado(cliente: Cliente, trasladoId: string): Promise<number> {
  const { data, error } = await cliente.rpc("admin_sugerir_tarifa_traslado", { p_traslado_id: trasladoId });
  if (error) throw error;
  if (data === null) throw new Error("No se pudo calcular una sugerencia de tarifa para este traslado.");
  return data;
}

export function simularTarifaNormativa(
  configuracion: ConfiguracionTarifas,
  entrada: {
    categoria: TarifaVehiculoRow["categoria"];
    gama: TarifaGamaRow["gama"];
    condicion: TarifaCondicionRow["condicion"];
    horario: TarifaHorarioRow["horario"];
    dia: TarifaDiaRow["dia"];
    distanciaKm: number;
    tiempoHoras: number;
  }
) {
  if (!configuracion.config) throw new Error("No hay configuración general de tarifas.");
  if (entrada.distanciaKm < 0 || entrada.tiempoHoras < 0) throw new Error("Distancia y tiempo deben ser mayores o iguales a 0.");

  const rango = entrada.distanciaKm <= 15 ? "rango_1" : entrada.distanciaKm <= 45 ? "rango_2" : entrada.distanciaKm <= 75 ? "rango_3" : "rango_4";
  const vehiculo = configuracion.vehiculo.find((fila) => fila.categoria === entrada.categoria && fila.rango === rango);
  const gama = configuracion.gama.find((fila) => fila.gama === entrada.gama);
  const condicion = configuracion.condicion.find((fila) => fila.condicion === entrada.condicion);
  const horario = configuracion.horario.find((fila) => fila.horario === entrada.horario);
  const dia = configuracion.dia.find((fila) => fila.dia === entrada.dia);

  if (!vehiculo || !gama || !condicion || !horario || !dia) {
    throw new Error("La configuración de tarifas está incompleta para simular este caso.");
  }

  const baseCategoria = vehiculo.base * gama.factor;
  const subtotal = baseCategoria + entrada.distanciaKm * vehiculo.por_km + entrada.tiempoHoras * configuracion.config.tarifa_hora;
  const factorVariable = Math.min(condicion.factor * horario.factor * dia.factor, configuracion.config.tope_factor_variable);
  const tarifa = Math.round(subtotal * factorVariable * 100) / 100;

  return {
    rango,
    baseCategoria,
    subtotal,
    factorVariable,
    tarifa
  };
}
