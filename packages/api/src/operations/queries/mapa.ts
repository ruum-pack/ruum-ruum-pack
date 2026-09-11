import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "../../services/permisos-admin";
import { type EstadoTraslado, type TrasladoMapa } from "../domain/tipos";

type Cliente = SupabaseClient<Database>;

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

type TrackingSaludMapaRow = {
  traslado_id: string;
  ultimo_punto_id: string | null;
  ultima_ubicacion_en: string | null;
  ultimo_envio_en: string | null;
  fuente: string | null;
  online: boolean | null;
  precision_m: number | null;
};

type UbicacionMapaRow = {
  id: string;
  lat: number;
  lng: number;
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
 * Admin para el mapa: id + rol operativo. Duplica la consulta mínima de
 * services/admin.ts (obtenerAdminActual) para no crear un ciclo
 * operations -> services/admin (admin.ts re-exporta este módulo como facade).
 */
async function obtenerAdminParaMapa(cliente: Cliente): Promise<{ id: string; rol_operativo: string | null } | null> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;
  const { data, error } = await cliente
    .from("admins")
    .select("id,rol_operativo")
    .eq("auth_user_id", sesion.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; rol_operativo: string | null } | null) ?? null;
}

async function obtenerAdminIdParaMapa(cliente: Cliente): Promise<string> {
  const admin = await obtenerAdminParaMapa(cliente);
  if (!admin) {
    throw new Error("No se encontró un admin autenticado para registrar auditoría.");
  }
  return admin.id;
}

/**
 * PRD §10.3 — Mapa operativo: traslados activos con coordenadas de origen y
 * destino para pintarlos en el mapa de la Torre de Control.
 * La vista pasaporte_digital no incluye lat/lng (son datos operativos del
 * traslado, no del pasaporte); se consultan directamente de la tabla traslados
 * unida con conductores y vehículos.
 */
export async function listarTrasladosActivosMapa(cliente: Cliente): Promise<TrasladoMapa[]> {
  await assertAdminPermission(cliente, "viajes:leer");
  const adminId = await obtenerAdminIdParaMapa(cliente);
  const admin = await obtenerAdminParaMapa(cliente);
  const puedeVerCoordenadasPrecisas = admin?.rol_operativo === "direccion" || admin?.rol_operativo === "supervisor" || admin?.rol_operativo === "operador";
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
  const trasladoIds = traslados.map((t) => t.id);
  const clienteLibre = cliente as unknown as {
    from: <T>(tabla: string) => {
      select: (columnas: string) => {
        in: (columna: string, valores: string[]) => Promise<{ data: T[] | null; error: Error | null }>;
      };
      insert: (fila: Record<string, unknown>) => Promise<{ error: Error | null }>;
    };
  };

  const tracking = trasladoIds.length > 0
    ? await clienteLibre
      .from<TrackingSaludMapaRow>("tracking_salud_traslado")
      .select("traslado_id, ultimo_punto_id, ultima_ubicacion_en, ultimo_envio_en, fuente, online, precision_m")
      .in("traslado_id", trasladoIds)
    : { data: [], error: null };

  if (tracking.error) throw tracking.error;

  const trackingRows = tracking.data ?? [];
  const puntoIds = trackingRows.map((row) => row.ultimo_punto_id).filter((id): id is string => Boolean(id));
  const puntos = puntoIds.length > 0
    ? await clienteLibre.from<UbicacionMapaRow>("ubicaciones_traslado").select("id, lat, lng").in("id", puntoIds)
    : { data: [], error: null };

  if (puntos.error) throw puntos.error;

  const trackingPorTraslado = new Map(trackingRows.map((row) => [row.traslado_id, row]));
  const puntoPorId = new Map((puntos.data ?? []).map((row) => [row.id, row]));

  await clienteLibre.from("auditoria_admin_seguridad").insert({
    admin_id: adminId,
    auth_user_id: (await cliente.auth.getUser()).data.user?.id ?? null,
    tipo: "consulta",
    recurso: "ubicaciones",
    accion: "mapa_operativo",
    datos: {
      total_traslados: traslados.length,
      total_con_gps: trackingRows.length,
      coordenadas_precisas: puedeVerCoordenadasPrecisas
    }
  });

  return traslados.map((t) => ({
    ...(() => {
      const salud = trackingPorTraslado.get(t.id);
      const punto = salud?.ultimo_punto_id ? puntoPorId.get(salud.ultimo_punto_id) : null;
      return {
        conductor_lat: puedeVerCoordenadasPrecisas ? (punto?.lat ?? null) : null,
        conductor_lng: puedeVerCoordenadasPrecisas ? (punto?.lng ?? null) : null,
        gps_actualizado_en: salud?.ultima_ubicacion_en ?? null,
        gps_recibido_en: salud?.ultimo_envio_en ?? null,
        gps_precision_m: salud?.precision_m ?? null,
        gps_fuente: salud?.fuente ?? null,
        gps_online: salud?.online ?? null,
        coordenadas_sensibles_protegidas: !puedeVerCoordenadasPrecisas && Boolean(punto)
      };
    })(),
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
