export interface LineaRutaMapbox {
  type: "LineString";
  coordinates: number[][];
}

export interface RutaDirectionsMapbox {
  geometry: LineaRutaMapbox | null;
  distanciaKm: number | null;
  tiempoHoras: number | null;
}

/**
 * Llama a Mapbox Directions (perfil "driving") entre dos coordenadas [lng, lat]
 * y normaliza la respuesta a km/horas. Usada tanto por panel-admin (ruta +
 * geometría para el mapa) como por app-usuario (solo distancia/tiempo).
 */
export async function obtenerRutaDirectionsMapbox(
  origen: [number, number],
  destino: [number, number],
  tokenAcceso: string
): Promise<RutaDirectionsMapbox | null> {
  const coordenadas = `${origen[0]},${origen[1]};${destino[0]},${destino[1]}`;
  try {
    const respuesta = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordenadas}?geometries=geojson&overview=simplified&access_token=${encodeURIComponent(tokenAcceso)}`
    );
    if (!respuesta.ok) return null;
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
  } catch {
    return null;
  }
}
