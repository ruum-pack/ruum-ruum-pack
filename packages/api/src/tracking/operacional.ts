import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

// FASE 10 — Tracking operacional: sesiones, heartbeat, salud y ETA.
// La telemetría por lotes y la cola offline quedan intactas (10.15).

type Cliente = SupabaseClient<Database>;

export type EstadoSaludTracking = "HEALTHY" | "DEGRADED" | "STALE" | "OFFLINE";

export interface SaludTracking {
  estado: EstadoSaludTracking;
  motivo: string;
  detenido: boolean;
  ultimo_envio_en: string | null;
  sesion_id: string | null;
}

export interface PuntoTracking {
  lat: number;
  lng: number;
  precision_m: number | null;
  velocidad_mps: number | null;
  bateria_pct: number | null;
  online: boolean | null;
  registrado_en: string;
}

export interface EstimacionLlegada {
  distancia_km: number | null;
  velocidad_kmh: number | null;
  eta_min: number | null;
  llegada_estimada_en: string | null;
  base: "gps" | "defecto";
}

const VELOCIDAD_DEFECTO_KMH = 40;

const esquemaTraslado = z.object({ p_traslado_id: esquemaUuid });

const esquemaHeartbeat = z.object({
  p_traslado_id: esquemaUuid,
  p_lat: z.number().min(-90).max(90),
  p_lng: z.number().min(-180).max(180),
  p_precision_m: z.number().min(0).max(10000).nullable().optional(),
  p_velocidad_mps: z.number().min(0).max(120).nullable().optional(),
  p_bateria_pct: z.number().int().min(0).max(100).nullable().optional(),
  p_online: z.boolean().optional(),
  p_plataforma: z.string().max(32).nullable().optional()
});

export async function iniciarSesionTracking(cliente: Cliente, trasladoId: string): Promise<string> {
  const { data, error } = await rpcValidado(cliente, "iniciar_sesion_tracking", esquemaTraslado, {
    p_traslado_id: trasladoId
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo iniciar la sesión de tracking.");
  return data as unknown as string;
}

export async function finalizarSesionTracking(cliente: Cliente, trasladoId: string): Promise<string> {
  const { data, error } = await rpcValidado(cliente, "finalizar_sesion_tracking", esquemaTraslado, {
    p_traslado_id: trasladoId
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo finalizar la sesión de tracking.");
  return data as unknown as string;
}

export async function registrarHeartbeatTracking(
  cliente: Cliente,
  params: {
    trasladoId: string;
    lat: number;
    lng: number;
    precisionM?: number | null;
    velocidadMps?: number | null;
    bateriaPct?: number | null;
    online?: boolean;
    plataforma?: string | null;
  }
): Promise<{ sesion_id: string; punto_id: string; salud: SaludTracking }> {
  const { data, error } = await rpcValidado(cliente, "registrar_heartbeat_tracking", esquemaHeartbeat, {
    p_traslado_id: params.trasladoId,
    p_lat: params.lat,
    p_lng: params.lng,
    p_precision_m: params.precisionM ?? null,
    p_velocidad_mps: params.velocidadMps ?? null,
    p_bateria_pct: params.bateriaPct ?? null,
    p_online: params.online ?? true,
    p_plataforma: params.plataforma ?? null
  });
  if (error) throw error;
  if (!data) throw new Error("Sin respuesta de heartbeat.");
  return data as unknown as { sesion_id: string; punto_id: string; salud: SaludTracking };
}

export async function obtenerSaludTracking(cliente: Cliente, trasladoId: string): Promise<SaludTracking> {
  const { data, error } = await rpcValidado(cliente, "evaluar_salud_tracking", esquemaTraslado, {
    p_traslado_id: trasladoId
  });
  if (error) throw error;
  if (!data) throw new Error("Sin respuesta de salud.");
  return data as unknown as SaludTracking;
}

export async function listarUbicacionesRecientes(
  cliente: Cliente,
  trasladoId: string,
  limite = 20
): Promise<PuntoTracking[]> {
  const { data, error } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: PuntoTracking[] | null; error: unknown }>;
          };
        };
      };
    };
  })
    .from("ubicaciones_traslado")
    .select("lat,lng,precision_m,velocidad_mps,bateria_pct,online,registrado_en")
    .eq("traslado_id", trasladoId)
    .order("registrado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

export interface DestinoTraslado {
  lat: number | null;
  lng: number | null;
  ciudad: string | null;
  direccion: string | null;
}

export async function obtenerDestinoTraslado(cliente: Cliente, trasladoId: string): Promise<DestinoTraslado | null> {
  const { data, error } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{ data: DestinoTraslado | null; error: unknown }>;
        };
      };
    };
  })
    .from("traslados")
    .select("lat:destino_lat,lng:destino_lng,ciudad:destino_ciudad,direccion:destino_direccion")
    .eq("id", trasladoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function haversineKm(origenLat: number, origenLng: number, destinoLat: number, destinoLng: number): number {  const radio = 6371;
  const aLat = (origenLat * Math.PI) / 180;
  const bLat = (destinoLat * Math.PI) / 180;
  const dLat = ((destinoLat - origenLat) * Math.PI) / 180;
  const dLng = ((destinoLng - origenLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * radio * Math.asin(Math.sqrt(a));
}

// 10.11 — ETA v1: distancia haversine al destino sobre velocidad media
// reciente; 40 km/h por defecto si no hay muestra.
export function calcularEta(
  ultimo: { lat: number; lng: number } | null,
  destino: { lat: number | null; lng: number | null } | null,
  puntosRecientes: PuntoTracking[]
): EstimacionLlegada {
  if (!ultimo || destino?.lat == null || destino?.lng == null) {
    return { distancia_km: null, velocidad_kmh: null, eta_min: null, llegada_estimada_en: null, base: "defecto" };
  }
  const distancia = haversineKm(ultimo.lat, ultimo.lng, destino.lat, destino.lng);
  const muestras = puntosRecientes
    .map((p) => (p.velocidad_mps ?? 0) * 3.6)
    .filter((v) => v > 1);
  const velocidad = muestras.length > 0 ? muestras.reduce((a, b) => a + b, 0) / muestras.length : VELOCIDAD_DEFECTO_KMH;
  const etaMin = velocidad > 0 ? Math.round((distancia / velocidad) * 60) : null;
  return {
    distancia_km: Math.round(distancia * 100) / 100,
    velocidad_kmh: Math.round(velocidad * 10) / 10,
    eta_min: etaMin,
    llegada_estimada_en: etaMin == null ? null : new Date(Date.now() + etaMin * 60000).toISOString(),
    base: muestras.length > 0 ? "gps" : "defecto"
  };
}
