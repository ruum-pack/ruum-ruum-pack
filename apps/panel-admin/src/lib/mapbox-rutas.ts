const tokenMapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export type LineaRuta = { type: "LineString"; coordinates: number[][] };

export interface RutaCalculada {
  geometry: LineaRuta;
  distanciaKm: number | null;
  tiempoHoras: number | null;
}

export function tieneMapboxConfigurado(): boolean {
  return Boolean(tokenMapbox);
}

/**
 * Llama a Mapbox Directions una sola vez y devuelve tanto la geometría (para
 * dibujar la ruta en el mapa) como distancia_km/tiempo_estimado_horas (para
 * la fórmula de tarifas, RT-12). Antes esta llamada solo se usaba para la
 * geometría y `distance`/`duration` se descartaban -- misma respuesta, ahora
 * también se leen esos dos campos.
 */
export async function obtenerRutaMapbox(
  origen: [number, number],
  destino: [number, number]
): Promise<RutaCalculada> {
  const lineaRecta: LineaRuta = { type: "LineString", coordinates: [origen, destino] };
  if (!tokenMapbox) return { geometry: lineaRecta, distanciaKm: null, tiempoHoras: null };

  const coordenadas = `${origen[0]},${origen[1]};${destino[0]},${destino[1]}`;
  try {
    const respuesta = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coordenadas}?geometries=geojson&overview=simplified&access_token=${encodeURIComponent(tokenMapbox)}`
    );
    if (!respuesta.ok) throw new Error("Directions no disponible");
    const datos = (await respuesta.json()) as {
      routes?: Array<{ geometry?: LineaRuta; distance?: number; duration?: number }>;
    };
    const ruta = datos.routes?.[0];
    if (!ruta) return { geometry: lineaRecta, distanciaKm: null, tiempoHoras: null };
    return {
      geometry: ruta.geometry ?? lineaRecta,
      // Mapbox devuelve distance en metros y duration en segundos.
      distanciaKm: typeof ruta.distance === "number" ? Math.round((ruta.distance / 1000) * 100) / 100 : null,
      tiempoHoras: typeof ruta.duration === "number" ? Math.round((ruta.duration / 3600) * 100) / 100 : null
    };
  } catch {
    return { geometry: lineaRecta, distanciaKm: null, tiempoHoras: null };
  }
}
