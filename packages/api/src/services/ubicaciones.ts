import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;

export interface UbicacionTraslado {
  id: string;
  traslado_id: string;
  conductor_id: string;
  lat: number;
  lng: number;
  precision_m: number | null;
  velocidad_mps: number | null;
  registrado_en: string;
}

export interface DatosUbicacionTraslado {
  trasladoId: string;
  lat: number;
  lng: number;
  precisionM?: number | null;
  velocidadMps?: number | null;
}

function tablaUbicaciones(cliente: Cliente) {
  return (cliente as unknown as SupabaseClient).from("ubicaciones_traslado");
}

async function obtenerConductorIdActual(cliente: Cliente): Promise<string> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) {
    throw new Error("Inicia sesión como conductor para reportar ubicación.");
  }

  const { data, error } = await cliente.from("conductores").select("id").eq("auth_user_id", sesion.user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No se encontró el conductor autenticado.");
  return data.id;
}

export async function registrarUbicacionTraslado(cliente: Cliente, datos: DatosUbicacionTraslado) {
  const conductorId = await obtenerConductorIdActual(cliente);
  const { data, error } = await tablaUbicaciones(cliente)
    .insert({
      traslado_id: datos.trasladoId,
      conductor_id: conductorId,
      lat: datos.lat,
      lng: datos.lng,
      precision_m: datos.precisionM ?? null,
      velocidad_mps: datos.velocidadMps ?? null
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as UbicacionTraslado;
}

export async function obtenerUltimaUbicacionTraslado(cliente: Cliente, trasladoId: string): Promise<UbicacionTraslado | null> {
  const { data, error } = await tablaUbicaciones(cliente)
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("registrado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as UbicacionTraslado | null) ?? null;
}

export function suscribirUbicacionTraslado(
  cliente: Cliente,
  trasladoId: string,
  alRecibir: (ubicacion: UbicacionTraslado) => void
): RealtimeChannel {
  return cliente
    .channel(`ubicaciones-traslado-${trasladoId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ubicaciones_traslado",
        filter: `traslado_id=eq.${trasladoId}`
      },
      (payload) => alRecibir(payload.new as UbicacionTraslado)
    )
    .subscribe();
}
