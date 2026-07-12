const tokenPublico = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const URL_GEOCODIFICACION = "https://api.mapbox.com/search/geocode/v6/forward";

export interface CoordenadasGeocodificadas { lat: number; lng: number; }

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
    if (!respuesta.ok) return [];
    const datos = (await respuesta.json()) as { features?: FeatureMapbox[] };
    return datos.features ?? [];
  } catch {
    return [];
  }
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
