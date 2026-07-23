import { obtenerRutaDirectionsMapbox, type LineaRutaMapbox } from "@ruum/shared/utils";

const tokenMapbox = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export type LineaRuta = LineaRutaMapbox;

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
 * la fórmula de tarifas, RT-12).
 */
export async function obtenerRutaMapbox(
  origen: [number, number],
  destino: [number, number]
): Promise<RutaCalculada> {
  const lineaRecta: LineaRuta = { type: "LineString", coordinates: [origen, destino] };
  if (!tokenMapbox) return { geometry: lineaRecta, distanciaKm: null, tiempoHoras: null };

  let ruta;
  try {
    ruta = await obtenerRutaDirectionsMapbox(origen, destino, tokenMapbox);
  } catch (error) {
    if (error instanceof Error && /401|unauthorized|token/i.test(error.message)) {
      throw new Error("Mapbox rechazó el token de acceso.");
    }
    if (error instanceof Error && /429|rate|quota|limit/i.test(error.message)) {
      throw new Error("Mapbox alcanzó el límite de cuota o frecuencia.");
    }
    throw error;
  }
  if (!ruta) return { geometry: lineaRecta, distanciaKm: null, tiempoHoras: null };
  return {
    geometry: ruta.geometry ?? lineaRecta,
    distanciaKm: ruta.distanciaKm,
    tiempoHoras: ruta.tiempoHoras
  };
}
