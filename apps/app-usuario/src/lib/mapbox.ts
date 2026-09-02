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

async function consultarMapbox(parametros: URLSearchParams): Promise<FeatureMapbox[]> {
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return [];
  parametros.set("access_token", token);
  parametros.set("country", "mx");
  parametros.set("language", "es");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPBOX_GEOCODING_TIMEOUT_MS);
  try {
    const respuesta = await fetch(`${URL_GEOCODIFICACION}?${parametros.toString()}`, { signal: controller.signal });
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
    void recordOperationalEvent("geocoding_failure", {
      error: controller.signal.aborted ? "timeout" : error instanceof Error ? error.message : "error_red"
    }, "warning");
    return [];
  } finally {
    clearTimeout(timeout);
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
export async function geocodificarDireccion(direccion: string): Promise<CoordenadasGeocodificadas | null> {
  const consulta = direccion.trim();
  if (!consulta) return null;
  const features = await consultarMapbox(new URLSearchParams({ q: consulta, limit: "1", autocomplete: "false" }));
  const coordenadas = features[0]?.geometry?.coordinates;
  if (!coordenadas) return null;
  const [lng, lat] = coordenadas;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** El catálogo postal local sigue siendo la fuente principal de estado,
 * ciudad y colonia; Mapbox aporta sugerencias complementarias. */
export async function sugerirDireccionesPorCodigoPostal(codigoPostal: string): Promise<string[]> {
  if (!/^\d{5}$/.test(codigoPostal)) return [];
  const features = await consultarMapbox(
    new URLSearchParams({ q: codigoPostal, limit: "3", types: "postcode", autocomplete: "false" })
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

export async function sugerirDireccionesAutocomplete(consulta: string): Promise<SugerenciaDireccion[]> {
  const q = consulta.trim();
  if (q.length < 3 || !tieneMapboxConfigurado()) return [];
  const params = new URLSearchParams({ q, limit: "5", autocomplete: "true", types: "address,street,place,locality,neighborhood" });
  // consultarMapbox ya limita a MX y ES
  const token = obtenerTokenPublico();
  if (!token) return [];
  params.set("access_token", token);
  params.set("country", "mx");
  params.set("language", "es");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPBOX_GEOCODING_TIMEOUT_MS);
  try {
    const res = await fetch(`${URL_GEOCODIFICACION}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) return [];
    const datos = (await res.json()) as { features?: FeatureDireccionDetallada[] };
    return (datos.features ?? []).slice(0, 5).map((f) => {
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
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function calcularRutaMapbox(
  origen: CoordenadasGeocodificadas,
  destino: CoordenadasGeocodificadas
): Promise<RutaMapboxCalculada | null> {
  const token = obtenerTokenPublico();
  if (!tieneMapboxConfigurado() || !token) return null;
  const ruta = await obtenerRutaDirectionsMapbox([origen.lng, origen.lat], [destino.lng, destino.lat], token, { lanzarErrores: true });
  if (ruta?.distanciaKm == null || ruta?.tiempoHoras == null) return null;
  return { distanciaKm: ruta.distanciaKm, tiempoEstimadoHoras: ruta.tiempoHoras };
}
