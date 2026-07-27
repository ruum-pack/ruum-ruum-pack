import { MapboxDirectionsError, obtenerRutaDirectionsMapbox } from "@ruum/shared/utils";

const tokenPublico = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const URL_GEOCODIFICACION = "https://api.mapbox.com/search/geocode/v6/forward";

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
  return Boolean(tokenPublico?.startsWith("pk."));
}

async function consultarMapbox(parametros: URLSearchParams): Promise<FeatureMapbox[]> {
  if (!tieneMapboxConfigurado() || !tokenPublico) return [];
  parametros.set("access_token", tokenPublico);
  parametros.set("country", "mx");
  parametros.set("language", "es");
  try {
    const respuesta = await fetch(`${URL_GEOCODIFICACION}?${parametros.toString()}`);
    if (!respuesta.ok) {
      throw new MapboxUsuarioError(`Mapbox Geocoding respondió ${respuesta.status}.`, respuesta.status);
    }
    const datos = (await respuesta.json()) as { features?: FeatureMapbox[] };
    return datos.features ?? [];
  } catch (error) {
    if (error instanceof MapboxUsuarioError) throw error;
    return [];
  }
}

export function esErrorConfiguracionMapbox(error: unknown): boolean {
  return (
    error instanceof MapboxUsuarioError ||
    error instanceof MapboxDirectionsError
  ) && [401, 403, 429].includes(error.status);
}

export function mensajeErrorMapbox(error: unknown): string {
  if (error instanceof MapboxUsuarioError || error instanceof MapboxDirectionsError) {
    if (error.status === 401 || error.status === 403) {
      return "Mapbox rechazó el token configurado. Revisa que NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN esté activo y autorizado para Geocoding y Directions.";
    }
    if (error.status === 429) {
      return "Mapbox alcanzó el límite de cuota o frecuencia. Intenta de nuevo en unos minutos.";
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

export async function calcularRutaMapbox(
  origen: CoordenadasGeocodificadas,
  destino: CoordenadasGeocodificadas
): Promise<RutaMapboxCalculada | null> {
  if (!tieneMapboxConfigurado() || !tokenPublico) return null;
  const ruta = await obtenerRutaDirectionsMapbox([origen.lng, origen.lat], [destino.lng, destino.lat], tokenPublico, { lanzarErrores: true });
  if (ruta?.distanciaKm == null || ruta?.tiempoHoras == null) return null;
  return { distanciaKm: ruta.distanciaKm, tiempoEstimadoHoras: ruta.tiempoHoras };
}
