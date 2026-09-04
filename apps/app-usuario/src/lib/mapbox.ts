import { MapboxDirectionsError, obtenerRutaDirectionsMapbox } from "@ruum/shared/utils";
import { recordOperationalEvent } from "./observability";
import { registrarEventoUx } from "./analytics";

function obtenerTokenPublico(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
}
const URL_GEOCODIFICACION = "https://api.mapbox.com/search/geocode/v6/forward";
export const MAPBOX_GEOCODING_TIMEOUT_MS = 8_000;
export const MAPBOX_GEOCODING_MAX_INTENTOS = 3;
export const MAPBOX_GEOCODING_RETRY_DELAY_MS = 300;

// Sec1: rate limiter cliente Mapbox — evita agotar cuota (600 req/min). Token bucket simple.
const MAPBOX_RPS_LIMIT = 8; // 480/min con margen bajo 600
const MAPBOX_RPM_LIMIT = 450;
const mapboxTimestamps: number[] = [];

async function adquirirPermisoMapbox(signal?: AbortSignal): Promise<void> {
  while (true) {
    if (signal?.aborted) return;
    const ahora = Date.now();
    while (mapboxTimestamps.length && mapboxTimestamps[0]! < ahora - 60_000) mapboxTimestamps.shift();
    const enUltimoSegundo = mapboxTimestamps.filter((t) => t > ahora - 1_000).length;
    const enUltimoMinuto = mapboxTimestamps.length;
    if (enUltimoSegundo < MAPBOX_RPS_LIMIT && enUltimoMinuto < MAPBOX_RPM_LIMIT) {
      mapboxTimestamps.push(ahora);
      return;
    }
    // 3.1 rate limit hit
    try {
      registrarEventoUx("traslado_rate_limit_hit", { error_code: enUltimoSegundo >= MAPBOX_RPS_LIMIT ? "rps" : "rpm", timestamp: new Date().toISOString() } as never);
    } catch {}
    const esperaSegundo = enUltimoSegundo >= MAPBOX_RPS_LIMIT
      ? (mapboxTimestamps[mapboxTimestamps.length - MAPBOX_RPS_LIMIT]! + 1_000 - ahora)
      : 0;
    const esperaMinuto = enUltimoMinuto >= MAPBOX_RPM_LIMIT
      ? (mapboxTimestamps[0]! + 60_000 - ahora)
      : 0;
    const espera = Math.max(esperaSegundo, esperaMinuto, 0);
    const ms = Math.min(Math.max(espera, 50), 1_000);
    const continuo = await new Promise<boolean>((resolve) => {
      let done = false;
      const fin = (v: boolean) => { if (done) return; done = true; clearTimeout(t); signal?.removeEventListener("abort", onAbort); resolve(v); };
      const onAbort = () => fin(false);
      const t = setTimeout(() => fin(true), ms);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    if (!continuo) return;
  }
}

export function __resetMapboxRateLimitForTest() {
  mapboxTimestamps.length = 0;
}

export interface CoordenadasGeocodificadas { lat: number; lng: number; }
export interface RutaMapboxCalculada { distanciaKm: number; tiempoEstimadoHoras: number; }

export class MapboxUsuarioError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "MapboxUsuarioError";
  }
}

interface FeatureMapbox {
  geometry?: { coordinates?: [number, number] };
  properties?: { full_address?: string; place_formatted?: string; name?: string };
}

export function tieneMapboxConfigurado(): boolean {
  return Boolean(obtenerTokenPublico()?.startsWith("pk."));
}

function esEstadoReintentable(status: number) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function esperarReintento(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let resuelto = false;
    const finalizar = (continuar: boolean) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelar);
      resolve(continuar);
    };
    const cancelar = () => finalizar(false);
    const timer = setTimeout(() => finalizar(true), ms);
    signal?.addEventListener("abort", cancelar, { once: true });
  });
}

async function consultarMapbox(parametros: URLSearchParams, externalSignal?: AbortSignal): Promise<FeatureMapbox[]> {
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return [];
  if (externalSignal?.aborted) return [];
  parametros.set("access_token", token);
  parametros.set("country", "mx");
  parametros.set("language", "es");
  let ultimoError: MapboxUsuarioError | null = null;

  for (let intento = 1; intento <= MAPBOX_GEOCODING_MAX_INTENTOS; intento += 1) {
    if (externalSignal?.aborted) return [];
    await adquirirPermisoMapbox(externalSignal);
    if (externalSignal?.aborted) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MAPBOX_GEOCODING_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
    let error: MapboxUsuarioError | null = null;

    try {
      const respuesta = await fetch(`${URL_GEOCODIFICACION}?${parametros.toString()}`, { signal: controller.signal });
      if (!respuesta.ok) {
        error = new MapboxUsuarioError(`Mapbox Geocoding respondió ${respuesta.status}.`, respuesta.status);
      } else {
        const datos = (await respuesta.json()) as { features?: FeatureMapbox[] };
        return datos.features ?? [];
      }
    } catch (rawError) {
      if (externalSignal?.aborted) return [];
      error = rawError instanceof MapboxUsuarioError
        ? rawError
        : controller.signal.aborted
          ? new MapboxUsuarioError("Mapbox Geocoding agotó el tiempo de espera.", 504)
          : new MapboxUsuarioError("Mapbox Geocoding no está disponible.", 503);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }

    ultimoError = error;
    const reintentable = error !== null && esEstadoReintentable(error.status);
    void recordOperationalEvent("geocoding_failure", {
      status: error?.status,
      scope: "geocoding_api",
      intento,
      max_intentos: MAPBOX_GEOCODING_MAX_INTENTOS,
      reintentando: reintentable && intento < MAPBOX_GEOCODING_MAX_INTENTOS
    }, reintentable && intento < MAPBOX_GEOCODING_MAX_INTENTOS ? "warning" : "error");
    try {
      if (error?.status === 429) registrarEventoUx("traslado_rate_limit_hit", { error_code: "429", timestamp: new Date().toISOString() } as never);
      else if (error) registrarEventoUx("traslado_geocodificacion_error", { error_code: String(error.status), timestamp: new Date().toISOString() } as never);
    } catch {}

    if (!error || !reintentable || intento >= MAPBOX_GEOCODING_MAX_INTENTOS) break;
    if (!(await esperarReintento(MAPBOX_GEOCODING_RETRY_DELAY_MS * 2 ** (intento - 1), externalSignal))) return [];
  }

  throw ultimoError ?? new MapboxUsuarioError("Mapbox Geocoding no está disponible.", 503);
}

export function esErrorConfiguracionMapbox(error: unknown): boolean {
  return (
    error instanceof MapboxUsuarioError ||
    error instanceof MapboxDirectionsError
  ) && [401, 403, 408, 425, 429, 502, 503, 504].includes(error.status);
}

export function mensajeErrorMapbox(error: unknown): string {
  // Sec2: mensajes genéricos para UI — detalles van a server log via recordOperationalEvent, nunca exponer env vars
  if (error instanceof MapboxUsuarioError || error instanceof MapboxDirectionsError) {
    if (error.status === 401 || error.status === 403) {
      return "Servicio de mapas no disponible temporalmente. Intenta de nuevo más tarde.";
    }
    if (error.status === 429) {
      return "Servicio de mapas con alta demanda. Intenta de nuevo en unos minutos.";
    }
    if (error.status === 408 || error.status === 502 || error.status === 503 || error.status === 504) {
      return "Servicio de mapas tardó demasiado. Puedes continuar y reintentaremos el cálculo.";
    }
  }
  return "No pudimos calcular distancia y tiempo en este momento.";
}

/** Nunca inventa 0,0: una dirección no resuelta conserva coordenadas NULL. */
export async function geocodificarDireccion(direccion: string, signal?: AbortSignal): Promise<CoordenadasGeocodificadas | null> {
  const consulta = direccion.trim();
  if (!consulta) return null;
  if (signal?.aborted) return null;
  const features = await consultarMapbox(new URLSearchParams({ q: consulta, limit: "1", autocomplete: "false" }), signal);
  const coordenadas = features[0]?.geometry?.coordinates;
  if (!coordenadas) return null;
  const [lng, lat] = coordenadas;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** El catálogo postal local sigue siendo la fuente principal de estado,
 * ciudad y colonia; Mapbox aporta sugerencias complementarias. */
export async function sugerirDireccionesPorCodigoPostal(codigoPostal: string, signal?: AbortSignal): Promise<string[]> {
  if (!/^\d{5}$/.test(codigoPostal)) return [];
  if (signal?.aborted) return [];
  const features = await consultarMapbox(
    new URLSearchParams({ q: codigoPostal, limit: "3", types: "postcode", autocomplete: "false" }),
    signal
  );
  return features
    .map((feature) => feature.properties?.full_address ??
      [feature.properties?.name, feature.properties?.place_formatted].filter(Boolean).join(", "))
    .filter((valor): valor is string => Boolean(valor));
}

export interface SugerenciaDireccion {
  textoCompleto: string;
  direccion: string;
  colonia?: string;
  ciudad?: string;
  estado?: string;
  codigoPostal?: string;
  lat?: number;
  lng?: number;
}

interface FeatureDireccionDetallada {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    full_address?: string;
    name?: string;
    place_formatted?: string;
    context?: {
      postcode?: { name?: string };
      place?: { name?: string };
      region?: { name?: string };
      locality?: { name?: string };
      neighborhood?: { name?: string };
      street?: { name?: string };
      address?: { name?: string };
    };
    address?: string;
    postcode?: string;
  };
}

export async function sugerirDireccionesAutocomplete(consulta: string, signal?: AbortSignal): Promise<SugerenciaDireccion[]> {
  const q = consulta.trim();
  if (q.length < 3 || !tieneMapboxConfigurado()) return [];
  if (signal?.aborted) return [];
  // R3: reutiliza consultarMapbox para centralizar token/país/idioma/timeout/telemetría y soporte de cancelación
  try {
    const rawFeatures = await consultarMapbox(
      new URLSearchParams({ q, limit: "5", autocomplete: "true", types: "address,street,place,locality,neighborhood" }),
      signal
    ) as unknown as FeatureDireccionDetallada[];
    return (rawFeatures ?? []).slice(0, 5).map((f) => {
      const coords = f.geometry?.coordinates;
      const ctx = f.properties?.context;
      return {
        textoCompleto: f.properties?.full_address ?? [f.properties?.name, f.properties?.place_formatted].filter(Boolean).join(", ") ?? q,
        direccion: f.properties?.address ?? f.properties?.name ?? "",
        colonia: ctx?.neighborhood?.name ?? ctx?.locality?.name,
        ciudad: ctx?.place?.name ?? ctx?.locality?.name,
        estado: ctx?.region?.name,
        codigoPostal: ctx?.postcode?.name ?? f.properties?.postcode,
        lat: coords?.[1],
        lng: coords?.[0],
      };
    }).filter(s => s.textoCompleto);
  } catch {
    // Autocomplete es sugerencia no bloqueante: 401/403 u otro error devuelve vacío sin propagar
    // consultarMapbox ya emitió recordOperationalEvent para el caso geocoding
    return [];
  }
}

export async function calcularRutaMapbox(
  origen: CoordenadasGeocodificadas,
  destino: CoordenadasGeocodificadas,
  signal?: AbortSignal
): Promise<RutaMapboxCalculada | null> {
  if (signal?.aborted) return null;
  await adquirirPermisoMapbox(signal);
  if (signal?.aborted) return null;
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return null;
  const ruta = await obtenerRutaDirectionsMapbox([origen.lng, origen.lat], [destino.lng, destino.lat], token, {
    lanzarErrores: true,
    signal,
    maxIntentos: MAPBOX_GEOCODING_MAX_INTENTOS,
    timeoutMs: MAPBOX_GEOCODING_TIMEOUT_MS,
    demoraReintentoMs: MAPBOX_GEOCODING_RETRY_DELAY_MS
  });
  if (signal?.aborted) return null;
  if (ruta?.distanciaKm == null || ruta?.tiempoHoras == null) return null;
  return { distanciaKm: ruta.distanciaKm, tiempoEstimadoHoras: ruta.tiempoHoras };
}

export async function calcularRutaMapboxConParadas(
  origen: CoordenadasGeocodificadas,
  destino: CoordenadasGeocodificadas,
  paradas: CoordenadasGeocodificadas[],
  signal?: AbortSignal
): Promise<RutaMapboxCalculada | null> {
  if (signal?.aborted) return null;
  await adquirirPermisoMapbox(signal);
  if (signal?.aborted) return null;
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return null;
  const { obtenerRutaDirectionsMapboxConParadas } = await import("@ruum/shared/utils");
  const ruta = await obtenerRutaDirectionsMapboxConParadas(
    [origen.lng, origen.lat],
    [destino.lng, destino.lat],
    paradas.map((p) => [p.lng, p.lat] as [number, number]),
    token,
    {
      lanzarErrores: true,
      signal,
      maxIntentos: MAPBOX_GEOCODING_MAX_INTENTOS,
      timeoutMs: MAPBOX_GEOCODING_TIMEOUT_MS,
      demoraReintentoMs: MAPBOX_GEOCODING_RETRY_DELAY_MS
    }
  );
  if (signal?.aborted) return null;
  if (ruta?.distanciaKm == null || ruta?.tiempoHoras == null) return null;
  return { distanciaKm: ruta.distanciaKm, tiempoEstimadoHoras: ruta.tiempoHoras };
}
