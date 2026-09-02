export interface LineaRutaMapbox {
  type: "LineString";
  coordinates: number[][];
}

export interface RutaDirectionsMapbox {
  geometry: LineaRutaMapbox | null;
  distanciaKm: number | null;
  tiempoHoras: number | null;
}

export class MapboxDirectionsError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "MapboxDirectionsError";
  }
}

export const MAPBOX_DIRECTIONS_TIMEOUT_MS = 10_000;

/**
 * Llama a Mapbox Directions (perfil "driving") entre dos coordenadas [lng, lat]
 * y normaliza la respuesta a km/horas. Usada tanto por panel-admin (ruta +
 * geometría para el mapa) como por app-usuario (solo distancia/tiempo).
 */
export async function obtenerRutaDirectionsMapbox(
  origen: [number, number],
  destino: [number, number],
  tokenAcceso: string,
  opciones: { lanzarErrores?: boolean; timeoutMs?: number } = {}
): Promise<RutaDirectionsMapbox | null> {
  return obtenerRutaDirectionsMapboxConParadas(origen, destino, [], tokenAcceso, opciones);
}

export async function obtenerRutaDirectionsMapboxConParadas(
  origen: [number, number],
  destino: [number, number],
  paradas: Array<[number, number]>,
  tokenAcceso: string,
  opciones: { lanzarErrores?: boolean; timeoutMs?: number } = {}
): Promise<RutaDirectionsMapbox | null> {
  const todos: Array<[number, number]> = [origen, ...paradas.slice(0, 8), destino];
  const coordenadas = todos.map((c) => `${c[0]},${c[1]}`).join(";");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opciones.timeoutMs ?? MAPBOX_DIRECTIONS_TIMEOUT_MS
  );
  try {
    const respuesta = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordenadas}?geometries=geojson&overview=simplified&access_token=${encodeURIComponent(tokenAcceso)}`,
      { signal: controller.signal }
    );
    if (!respuesta.ok) {
      if (opciones.lanzarErrores) {
        throw new MapboxDirectionsError(`Mapbox Directions respondió ${respuesta.status}.`, respuesta.status);
      }
      return null;
    }
    const datos = (await respuesta.json()) as {
      routes?: Array<{ geometry?: LineaRutaMapbox; distance?: number; duration?: number }>;
    };
    const ruta = datos.routes?.[0];
    if (!ruta) return null;
    return {
      geometry: ruta.geometry ?? null,
      // Mapbox devuelve distance en metros y duration en segundos.
      distanciaKm: typeof ruta.distance === "number" ? Math.round((ruta.distance / 1000) * 100) / 100 : null,
      tiempoHoras: typeof ruta.duration === "number" ? Math.round((ruta.duration / 3600) * 100) / 100 : null
    };
  } catch (error) {
    if (opciones.lanzarErrores && error instanceof MapboxDirectionsError) throw error;
    if (opciones.lanzarErrores && controller.signal.aborted) {
      throw new MapboxDirectionsError("Mapbox Directions agotó el tiempo de espera.", 504);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
