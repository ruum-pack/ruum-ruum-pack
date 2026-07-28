import { obtenerRutaDirectionsMapbox } from "@ruum/shared/utils";

const tokenPublico = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const URL_GEOCODIFICACION = "https://api.mapbox.com/search/geocode/v6/forward";

export interface CoordenadasMasivas {
  lat: number;
  lng: number;
}

export interface RutaMasivaCalculada {
  distanciaKm: number | null;
  tiempoEstimadoHoras: number | null;
}

interface FeatureMapbox {
  geometry?: { coordinates?: [number, number] };
}

export function tieneMapboxMasivosConfigurado() {
  return Boolean(tokenPublico?.startsWith("pk."));
}

export async function geocodificarDireccionMasiva(direccion: string): Promise<CoordenadasMasivas | null> {
  const consulta = direccion.trim();
  if (!consulta || !tieneMapboxMasivosConfigurado() || !tokenPublico) return null;

  try {
    const parametros = new URLSearchParams({
      q: consulta,
      limit: "1",
      autocomplete: "false",
      country: "mx",
      language: "es",
      access_token: tokenPublico
    });
    const respuesta = await fetch(`${URL_GEOCODIFICACION}?${parametros.toString()}`);
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as { features?: FeatureMapbox[] };
    const coordenadas = datos.features?.[0]?.geometry?.coordinates;
    if (!coordenadas) return null;
    const [lng, lat] = coordenadas;
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

export async function calcularRutaMasiva(
  origen: CoordenadasMasivas | null,
  destino: CoordenadasMasivas | null
): Promise<RutaMasivaCalculada | null> {
  if (!origen || !destino || !tieneMapboxMasivosConfigurado() || !tokenPublico) return null;
  const ruta = await obtenerRutaDirectionsMapbox([origen.lng, origen.lat], [destino.lng, destino.lat], tokenPublico);
  if (!ruta) return null;
  return {
    distanciaKm: ruta.distanciaKm,
    tiempoEstimadoHoras: ruta.tiempoHoras
  };
}
