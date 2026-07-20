import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarUbicacionTraslado } from "@ruum/api/services";
import { distanciaMetrosEntre, type Coordenadas } from "./ubicacion";
import { guardarJsonLocalSeguro, leerJsonLocalSeguro, eliminarJsonLocalSeguro } from "./almacenamiento-seguro-local";

const CLAVE_COLA_TELEMETRIA = "ruum_cola_telemetria_v1";
const MAX_PUNTOS_COLA = 500;
const DISTANCIA_SIGNIFICATIVA_M = 25;
const BACKOFF_TELEMETRIA_MS = [30_000, 2 * 60_000, 5 * 60_000, 15 * 60_000];

export interface PuntoTelemetriaLocal {
  localId: string;
  trasladoId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  speedMps?: number | null;
  heading?: number | null;
  deviceTimestamp: string;
  attempts: number;
  lastAttemptAt?: string;
  critical?: boolean;
}

export interface TelemetryQueueStorage {
  read(): Promise<PuntoTelemetriaLocal[]>;
  write(items: PuntoTelemetriaLocal[]): Promise<void>;
  clear(): Promise<void>;
}

export class SecureTelemetryQueueStorage implements TelemetryQueueStorage {
  async read() {
    return normalizar(await leerJsonLocalSeguro<PuntoTelemetriaLocal[]>(CLAVE_COLA_TELEMETRIA));
  }

  async write(items: PuntoTelemetriaLocal[]) {
    await guardarJsonLocalSeguro(CLAVE_COLA_TELEMETRIA, normalizar(items));
  }

  async clear() {
    await eliminarJsonLocalSeguro(CLAVE_COLA_TELEMETRIA);
  }
}

export class InMemoryTelemetryQueueStorage implements TelemetryQueueStorage {
  constructor(private items: PuntoTelemetriaLocal[] = []) {}

  async read() {
    return normalizar(this.items);
  }

  async write(items: PuntoTelemetriaLocal[]) {
    this.items = normalizar(items);
  }

  async clear() {
    this.items = [];
  }
}

let storageTelemetria: TelemetryQueueStorage = new SecureTelemetryQueueStorage();

export function configurarStorageTelemetria(storage: TelemetryQueueStorage) {
  storageTelemetria = storage;
}

function normalizar(items: unknown): PuntoTelemetriaLocal[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => item as PuntoTelemetriaLocal)
    .filter((item) => item.localId && item.trasladoId && Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({
      ...item,
      attempts: Number.isInteger(item.attempts) && item.attempts >= 0 ? item.attempts : 0
    }));
}

function esPuntoIdentico(a: PuntoTelemetriaLocal, b: PuntoTelemetriaLocal) {
  return a.trasladoId === b.trasladoId && a.latitude === b.latitude && a.longitude === b.longitude && a.accuracyM === b.accuracyM;
}

function debeGuardarPunto(ultimo: PuntoTelemetriaLocal | undefined, siguiente: PuntoTelemetriaLocal) {
  if (!ultimo || ultimo.trasladoId !== siguiente.trasladoId) return true;
  if (siguiente.critical) return true;
  if (esPuntoIdentico(ultimo, siguiente)) return false;
  return distanciaMetrosEntre(
    { lat: ultimo.latitude, lng: ultimo.longitude },
    { lat: siguiente.latitude, lng: siguiente.longitude }
  ) >= DISTANCIA_SIGNIFICATIVA_M;
}

function limitarTamano(items: PuntoTelemetriaLocal[]) {
  if (items.length <= MAX_PUNTOS_COLA) return items;
  const criticos = items.filter((item) => item.critical);
  const recientes = items.filter((item) => !item.critical).slice(-(MAX_PUNTOS_COLA - criticos.length));
  return [...criticos, ...recientes].slice(-MAX_PUNTOS_COLA);
}

export async function encolarPuntoTelemetria(
  trasladoId: string,
  ubicacion: Coordenadas & { heading?: number | null },
  opciones: { critical?: boolean; localId?: string; deviceTimestamp?: string } = {}
) {
  const cola = await leerColaTelemetria();
  const punto: PuntoTelemetriaLocal = {
    localId: opciones.localId ?? crypto.randomUUID(),
    trasladoId,
    latitude: ubicacion.lat,
    longitude: ubicacion.lng,
    accuracyM: ubicacion.precisionM ?? null,
    speedMps: ubicacion.velocidadMps ?? null,
    heading: ubicacion.heading ?? null,
    deviceTimestamp: opciones.deviceTimestamp ?? new Date().toISOString(),
    attempts: 0,
    critical: opciones.critical ?? false
  };

  const ultimo = cola.at(-1);
  if (!debeGuardarPunto(ultimo, punto)) return false;

  await storageTelemetria.write(limitarTamano([...cola, punto]));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ruum:telemetria-pendiente"));
  return true;
}

export async function leerColaTelemetria(trasladoId?: string) {
  const cola = normalizar(await storageTelemetria.read());
  return trasladoId ? cola.filter((item) => item.trasladoId === trasladoId) : cola;
}

export async function contarColaTelemetria() {
  return (await leerColaTelemetria()).length;
}

function puedeReintentarse(item: PuntoTelemetriaLocal, ahoraMs = Date.now()) {
  if (!item.lastAttemptAt) return true;
  const ultimoIntentoMs = new Date(item.lastAttemptAt).getTime();
  if (!Number.isFinite(ultimoIntentoMs)) return true;
  const backoff = BACKOFF_TELEMETRIA_MS[Math.min(item.attempts, BACKOFF_TELEMETRIA_MS.length - 1)] ?? BACKOFF_TELEMETRIA_MS.at(-1)!;
  return ahoraMs - ultimoIntentoMs >= backoff;
}

async function marcarFallo(item: PuntoTelemetriaLocal) {
  const ahora = new Date().toISOString();
  const cola = await leerColaTelemetria();
  await storageTelemetria.write(
    cola.map((existente) =>
      existente.localId === item.localId
        ? { ...existente, attempts: existente.attempts + 1, lastAttemptAt: ahora }
        : existente
    )
  );
}

async function quitarConfirmado(localId: string) {
  const cola = await leerColaTelemetria();
  await storageTelemetria.write(cola.filter((item) => item.localId !== localId));
}

export async function sincronizarColaTelemetria(
  cliente: SupabaseClient<Database>,
  opciones: { ignoreBackoff?: boolean } = {}
) {
  const cola = await leerColaTelemetria();
  const items = opciones.ignoreBackoff ? cola : cola.filter((item) => puedeReintentarse(item));
  let sincronizados = 0;

  for (const item of items) {
    try {
      await registrarUbicacionTraslado(cliente, {
        trasladoId: item.trasladoId,
        lat: item.latitude,
        lng: item.longitude,
        precisionM: item.accuracyM ?? null,
        velocidadMps: item.speedMps ?? null
      });
      await quitarConfirmado(item.localId);
      sincronizados += 1;
    } catch (error) {
      await marcarFallo(item);
      throw error;
    }
  }

  if (sincronizados > 0 && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ruum:telemetria-sincronizada"));
  return sincronizados;
}

export async function limpiarColaTelemetria() {
  await storageTelemetria.clear();
}

export const OFFLINE_TELEMETRY_QUEUE_KEY = CLAVE_COLA_TELEMETRIA;

