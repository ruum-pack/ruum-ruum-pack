import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@ruum/shared/types";
import { esquemaUuid, rpcValidado } from "../services/_rpc-validado";

// FASE 9 — Cadena digital de custodia: registro, timeline, verificación y
// reporte future-ready (PDF). La cadena es append-only y tamper-evident.

type Cliente = SupabaseClient<Database>;

export type TipoEventoCustodia =
  | "pickup_started"
  | "vehicle_inspected"
  | "vehicle_received"
  | "transfer_started"
  | "stop_registered"
  | "incident_reported"
  | "destination_reached"
  | "delivery_inspection"
  | "vehicle_delivered"
  | "delivery_accepted";

export type ActorCustodia = "conductor" | "usuario" | "admin" | "sistema";

export interface EventoCustodia {
  id: string;
  traslado_id: string;
  vehiculo_id: string | null;
  actor_id: string | null;
  actor_tipo: ActorCustodia;
  tipo: TipoEventoCustodia;
  lat: number | null;
  lng: number | null;
  odometro: number | null;
  combustible: string | null;
  ocurrido_en: string;
  inspeccion_id: string | null;
  firma_metodo: string | null;
  pin_verificado: boolean;
  notas: string | null;
  metadata: Record<string, unknown>;
  prev_hash: string;
  hash_cadena: string;
  creado_en: string;
  fotos: Array<{
    id: string;
    tipo: string;
    angulo: string;
    url: string | null;
    lat: number | null;
    lng: number | null;
    capturada_en: string;
  }>;
}

export interface ReporteCustodia {
  traslado_id: string;
  vehiculo: { marca: string | null; modelo: string | null; placas: string | null; vin: string | null } | null;
  cadena_integra: boolean;
  total_eventos: number;
  eventos: EventoCustodia[];
  generado_en: string;
}

const esquemaRegistrar = z.object({
  p_traslado_id: esquemaUuid,
  p_tipo: z.enum([
    "pickup_started",
    "vehicle_inspected",
    "vehicle_received",
    "transfer_started",
    "stop_registered",
    "incident_reported",
    "destination_reached",
    "delivery_inspection",
    "vehicle_delivered",
    "delivery_accepted"
  ]),
  p_lat: z.number().min(-90).max(90).nullable().optional(),
  p_lng: z.number().min(-180).max(180).nullable().optional(),
  p_odometro: z.number().nonnegative().nullable().optional(),
  p_combustible: z.string().max(60).nullable().optional(),
  p_ocurrido_en: z.string().nullable().optional(),
  p_foto_ids: z.array(esquemaUuid).max(40).optional(),
  p_inspeccion_id: esquemaUuid.nullable().optional(),
  p_firma_metodo: z.string().max(60).nullable().optional(),
  p_pin_verificado: z.boolean().optional(),
  p_notas: z.string().max(2000).nullable().optional(),
  p_metadata: z.record(z.string(), z.unknown()).optional()
});

export async function registrarEventoCustodia(
  cliente: Cliente,
  params: {
    trasladoId: string;
    tipo: TipoEventoCustodia;
    lat?: number | null;
    lng?: number | null;
    odometro?: number | null;
    combustible?: string | null;
    ocurridoEn?: string | null;
    fotoIds?: string[];
    inspeccionId?: string | null;
    firmaMetodo?: string | null;
    pinVerificado?: boolean;
    notas?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const { data, error } = await rpcValidado(cliente, "registrar_evento_custodia", esquemaRegistrar, {
    p_traslado_id: params.trasladoId,
    p_tipo: params.tipo,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_odometro: params.odometro ?? null,
    p_combustible: params.combustible ?? null,
    p_ocurrido_en: params.ocurridoEn ?? null,
    p_foto_ids: params.fotoIds ?? [],
    p_inspeccion_id: params.inspeccionId ?? null,
    p_firma_metodo: params.firmaMetodo ?? null,
    p_pin_verificado: params.pinVerificado ?? false,
    p_notas: params.notas ?? null,
    p_metadata: (params.metadata ?? {}) as Record<string, z.infer<z.ZodUnknown>>
  });
  if (error) throw error;
  if (!data) throw new Error("No se pudo registrar el evento de custodia.");
  return data as unknown as string;
}

export async function verificarCadenaCustodia(cliente: Cliente, trasladoId: string): Promise<boolean> {
  const { data, error } = await rpcValidado(
    cliente,
    "verificar_cadena_custodia",
    z.object({ p_traslado_id: esquemaUuid }),
    { p_traslado_id: trasladoId }
  );
  if (error) throw error;
  return data === true;
}

export async function listarEventosCustodia(cliente: Cliente, trasladoId: string): Promise<EventoCustodia[]> {
  const base = (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          order: (col: string, o: { ascending: boolean }) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
        };
      };
    };
  });
  const { data: eventos, error } = await base
    .from("custodia_eventos")
    .select("*")
    .eq("traslado_id", trasladoId)
    .order("ocurrido_en", { ascending: true });
  if (error) throw error;
  if (!eventos || eventos.length === 0) return [];

  const ids = eventos.map((e) => String(e["id"]));
  const { data: joins, error: errorJoins } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (col: string, v: string[]) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
      };
    };
  })
    .from("custodia_evento_fotos")
    .select("evento_id,foto_id")
    .in("evento_id", ids);
  if (errorJoins) throw errorJoins;

  const fotoIds = [...new Set((joins ?? []).map((j) => String(j["foto_id"])))];
  let fotos: Array<Record<string, unknown>> = [];
  if (fotoIds.length > 0) {
    const { data: fotosData, error: errorFotos } = await (cliente as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (col: string, v: string[]) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
        };
      };
    })
      .from("evidencia_fotos")
      .select("id,tipo,angulo,url,lat,lng,capturada_en")
      .in("id", fotoIds);
    if (errorFotos) throw errorFotos;
    fotos = fotosData ?? [];
  }
  const fotoPorId = new Map(fotos.map((f) => [String(f["id"]), f]));
  const fotosPorEvento = new Map<string, Array<Record<string, unknown>>>();
  for (const j of joins ?? []) {
    const lista = fotosPorEvento.get(String(j["evento_id"])) ?? [];
    const foto = fotoPorId.get(String(j["foto_id"]));
    if (foto) lista.push(foto);
    fotosPorEvento.set(String(j["evento_id"]), lista);
  }

  return eventos.map((e) => ({
    id: String(e["id"]),
    traslado_id: String(e["traslado_id"]),
    vehiculo_id: (e["vehiculo_id"] as string | null) ?? null,
    actor_id: (e["actor_id"] as string | null) ?? null,
    actor_tipo: e["actor_tipo"] as ActorCustodia,
    tipo: e["tipo"] as TipoEventoCustodia,
    lat: (e["lat"] as number | null) ?? null,
    lng: (e["lng"] as number | null) ?? null,
    odometro: (e["odometro"] as number | null) ?? null,
    combustible: (e["combustible"] as string | null) ?? null,
    ocurrido_en: String(e["ocurrido_en"]),
    inspeccion_id: (e["inspeccion_id"] as string | null) ?? null,
    firma_metodo: (e["firma_metodo"] as string | null) ?? null,
    pin_verificado: Boolean(e["pin_verificado"]),
    notas: (e["notas"] as string | null) ?? null,
    metadata: (e["metadata"] as Record<string, unknown>) ?? {},
    prev_hash: String(e["prev_hash"]),
    hash_cadena: String(e["hash_cadena"]),
    creado_en: String(e["creado_en"]),
    fotos: (fotosPorEvento.get(String(e["id"])) ?? []).map((f) => ({
      id: String(f["id"]),
      tipo: String(f["tipo"]),
      angulo: String(f["angulo"]),
      url: (f["url"] as string | null) ?? null,
      lat: (f["lat"] as number | null) ?? null,
      lng: (f["lng"] as number | null) ?? null,
      capturada_en: String(f["capturada_en"])
    }))
  }));
}

export async function obtenerReporteCustodia(cliente: Cliente, trasladoId: string): Promise<ReporteCustodia> {
  const { data: traslado, error: errorTraslado } = await (cliente as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{ data: { vehiculo_id: string | null } | null; error: unknown }>;
        };
      };
    };
  })
    .from("traslados")
    .select("vehiculo_id")
    .eq("id", trasladoId)
    .maybeSingle();
  if (errorTraslado) throw errorTraslado;

  let vehiculo: ReporteCustodia["vehiculo"] = null;
  if (traslado?.vehiculo_id) {
    const { data: v, error: errorVehiculo } = await (cliente as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          };
        };
      };
    })
      .from("vehiculos")
      .select("marca,modelo,placas,vin")
      .eq("id", traslado.vehiculo_id)
      .maybeSingle();
    if (errorVehiculo) throw errorVehiculo;
    if (v) {
      vehiculo = {
        marca: (v["marca"] as string | null) ?? null,
        modelo: (v["modelo"] as string | null) ?? null,
        placas: (v["placas"] as string | null) ?? null,
        vin: (v["vin"] as string | null) ?? null
      };
    }
  }

  const [eventos, integra] = await Promise.all([
    listarEventosCustodia(cliente, trasladoId),
    verificarCadenaCustodia(cliente, trasladoId)
  ]);

  return {
    traslado_id: trasladoId,
    vehiculo,
    cadena_integra: integra,
    total_eventos: eventos.length,
    eventos,
    generado_en: new Date().toISOString()
  };
}
