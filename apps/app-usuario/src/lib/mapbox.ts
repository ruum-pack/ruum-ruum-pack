import { MapboxDirectionsError, obtenerRutaDirectionsMapbox } from "@ruum/shared/utils";
import { recordOperationalEvent } from "./observability";

function obtenerTokenPublico(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
}
const URL_GEOCODIFICACION = "https://api.mapbox.com/search/geocode/v6/forward";
const MAPBOX_GEOCODING_TIMEOUT_MS = 10_000;

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

async function consultarMapbox(parametros: URLSearchParams, externalSignal?: AbortSignal): Promise<FeatureMapbox[]> {
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return [];
  if (externalSignal?.aborted) return [];
  parametros.set("access_token", token);
  parametros.set("country", "mx");
  parametros.set("language", "es");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPBOX_GEOCODING_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  // Combinar señales: aborta si cualquiera de las dos lo hace
  const signal = controller.signal;
  try {
    const respuesta = await fetch(`${URL_GEOCODIFICACION}?${parametros.toString()}`, { signal });
    if (!respuesta.ok) {
      void recordOperationalEvent("geocoding_failure", {
        status: respuesta.status,
        scope: "geocoding_api"
      }, "warning");
      throw new MapboxUsuarioError(`Mapbox Geocoding respondió ${respuesta.status}.`, respuesta.status);
    }
    const datos = (await respuesta.json()) as { features?: FeatureMapbox[] };
    return datos.features ?? [];
  } catch (error) {
    if (error instanceof MapboxUsuarioError) throw error;
    // R3: abort por cancelación de usuario (sequence superseded) no es fallo operativo
    const esAbortExterno = externalSignal?.aborted;
    const esTimeout = controller.signal.aborted && !esAbortExterno;
    if (error instanceof DOMException && error.name === "AbortError" && esAbortExterno) {
      // Cancelación intencional: silenciar sin telemetría
      return [];
    }
    void recordOperationalEvent("geocoding_failure", {
      error: esTimeout ? "timeout" : error instanceof Error ? error.message : "error_red",
      aborted: esAbortExterno ? "cancelado" : undefined
    }, "warning");
    return [];
  } finally {
    clearTimeout(timeout);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

export function esErrorConfiguracionMapbox(error: unknown): boolean {
  return (
    error instanceof MapboxUsuarioError ||
    error instanceof MapboxDirectionsError
  ) && [401, 403, 429, 504].includes(error.status);
}

export function mensajeErrorMapbox(error: unknown): string {
  if (error instanceof MapboxUsuarioError || error instanceof MapboxDirectionsError) {
    if (error.status === 401 || error.status === 403) {
      return "Mapbox rechazó el token configurado. Revisa que NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN esté activo y autorizado para Geocoding y Directions.";
    }
    if (error.status === 429) {
      return "Mapbox alcanzó el límite de cuota o frecuencia. Intenta de nuevo en unos minutos.";
    }
    if (error.status === 504) {
      return "Mapbox tardó demasiado en responder. La ruta se podrá calcular de nuevo más tarde.";
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
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return null;
  const ruta = await obtenerRutaDirectionsMapbox([origen.lng, origen.lat], [destino.lng, destino.lat], token, { lanzarErrores: true });
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
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return null;
  const { obtenerRutaDirectionsMapboxConParadas } = await import("@ruum/shared/utils");
  const ruta = await obtenerRutaDirectionsMapboxConParadas(
    [origen.lng, origen.lat],
    [destino.lng, destino.lat],
    paradas.map((p) => [p.lng, p.lat] as [number, number]),
    token,
    { lanzarErrores: true }
  );
  if (signal?.aborted) return null;
  if (ruta?.distanciaKm == null || ruta?.tiempoHoras == null) return null;
  return { distanciaKm: ruta.distanciaKm, tiempoEstimadoHoras: ruta.tiempoHoras };
}
