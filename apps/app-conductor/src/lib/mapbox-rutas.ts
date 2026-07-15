import { obtenerRutaDirectionsMapbox, codificarPolyline } from "@ruum/shared/utils";

const tokenMapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const ESTILO_MAPA = "mapbox/streets-v12";

export function tieneMapboxConfigurado(): boolean {
  return Boolean(tokenMapbox);
}

export interface PuntoMapa {
  lat: number;
  lng: number;
}

/**
 * Mapa estático (Mapbox Static Images API) en vez de mapbox-gl: sin WebGL de
 * por medio, más liviano y más confiable dentro del WebView de Capacitor.
 * Si hay ubicación del conductor, dibuja también la ruta calculada con
 * Directions; si no, solo marca el punto de destino.
 */
export async function construirUrlMapaRutaOrigen(
  destino: PuntoMapa,
  origenConductor: PuntoMapa | null,
  opciones: { ancho?: number; alto?: number } = {}
): Promise<string | null> {
  if (!tokenMapbox) return null;
  const ancho = opciones.ancho ?? 600;
  const alto = opciones.alto ?? 260;

  const pinDestino = `pin-s-b+f5a623(${destino.lng},${destino.lat})`;

  if (!origenConductor) {
    return `https://api.mapbox.com/styles/v1/${ESTILO_MAPA}/static/${pinDestino}/${destino.lng},${destino.lat},13/${ancho}x${alto}@2x?access_token=${encodeURIComponent(tokenMapbox)}`;
  }

  const pinOrigen = `pin-s-a+1e88e5(${origenConductor.lng},${origenConductor.lat})`;
  const ruta = await obtenerRutaDirectionsMapbox([origenConductor.lng, origenConductor.lat], [destino.lng, destino.lat], tokenMapbox);

  const overlays = [pinOrigen, pinDestino];
  if (ruta?.geometry?.coordinates?.length) {
    const polyline = codificarPolyline(ruta.geometry.coordinates);
    overlays.unshift(`path-4+1e88e5-0.85(${encodeURIComponent(polyline)})`);
  }

  return `https://api.mapbox.com/styles/v1/${ESTILO_MAPA}/static/${overlays.join(",")}/auto/${ancho}x${alto}@2x?padding=40&access_token=${encodeURIComponent(tokenMapbox)}`;
}
