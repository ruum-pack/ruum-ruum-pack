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

export interface OpcionesDirectionsMapbox {
  lanzarErrores?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Se deja en 1 por defecto para no cambiar a otros consumidores. */
  maxIntentos?: number;
  demoraReintentoMs?: number;
}

type ResultadoIntentoDirections = RutaDirectionsMapbox | null | undefined;

function esEstadoReintentable(status: number) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function esperarReintento(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let resuelto = false;
    const finalizar = (continuar: boolean) => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancelar);
      resolve(continuar);
    };
    const cancelar = () => finalizar(false);
    const timer = setTimeout(() => finalizar(true), ms);
    signal?.addEventListener("abort", cancelar, { once: true });
  });
}

/**
 * Llama a Mapbox Directions (perfil "driving") entre dos coordenadas [lng, lat]
 * y normaliza la respuesta a km/horas. Usada tanto por panel-admin (ruta +
 * geometría para el mapa) como por app-usuario (solo distancia/tiempo).
 */
export async function obtenerRutaDirectionsMapbox(
  origen: [number, number],
  destino: [number, number],
  tokenAcceso: string,
  opciones: OpcionesDirectionsMapbox = {}
): Promise<RutaDirectionsMapbox | null> {
  return obtenerRutaDirectionsMapboxConParadas(origen, destino, [], tokenAcceso, opciones);
}

export async function obtenerRutaDirectionsMapboxConParadas(
  origen: [number, number],
  destino: [number, number],
  paradas: Array<[number, number]>,
  tokenAcceso: string,
  opciones: OpcionesDirectionsMapbox = {}
): Promise<RutaDirectionsMapbox | null> {
  const todos: Array<[number, number]> = [origen, ...paradas.slice(0, 8), destino];
  const coordenadas = todos.map((c) => `${c[0]},${c[1]}`).join(";");
  const maxIntentos = Math.max(1, Math.floor(opciones.maxIntentos ?? 1));
  const demoraBase = Math.max(0, opciones.demoraReintentoMs ?? 300);
  let ultimoError: MapboxDirectionsError | null = null;

  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    if (opciones.signal?.aborted) return null;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opciones.timeoutMs ?? MAPBOX_DIRECTIONS_TIMEOUT_MS
    );
    let resultado: ResultadoIntentoDirections;
    let error: MapboxDirectionsError | null = null;
    const onExternalAbort = () => controller.abort();
    opciones.signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const respuesta = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordenadas}?geometries=geojson&overview=simplified&access_token=${encodeURIComponent(tokenAcceso)}`,
        { signal: controller.signal }
      );
      if (!respuesta.ok) {
        error = new MapboxDirectionsError(`Mapbox Directions respondió ${respuesta.status}.`, respuesta.status);
      } else {
        const datos = (await respuesta.json()) as {
          routes?: Array<{ geometry?: LineaRutaMapbox; distance?: number; duration?: number }>;
        };
        const ruta = datos.routes?.[0];
        resultado = ruta ? {
          geometry: ruta.geometry ?? null,
          // Mapbox devuelve distance en metros y duration en segundos.
          distanciaKm: typeof ruta.distance === "number" ? Math.round((ruta.distance / 1000) * 100) / 100 : null,
          tiempoHoras: typeof ruta.duration === "number" ? Math.round((ruta.duration / 3600) * 100) / 100 : null
        } : null;
      }
    } catch (rawError) {
      if (opciones.signal?.aborted) return null;
      error = rawError instanceof MapboxDirectionsError
        ? rawError
        : controller.signal.aborted
          ? new MapboxDirectionsError("Mapbox Directions agotó el tiempo de espera.", 504)
          : new MapboxDirectionsError("Mapbox Directions no está disponible.", 503);
    } finally {
      clearTimeout(timeout);
      opciones.signal?.removeEventListener("abort", onExternalAbort);
    }

    if (!error) return resultado ?? null;
    ultimoError = error;

    if (!esEstadoReintentable(error.status) || intento >= maxIntentos) break;
    const continuar = await esperarReintento(demoraBase * 2 ** (intento - 1), opciones.signal);
    if (!continuar) return null;
  }

  if (opciones.lanzarErrores && ultimoError) throw ultimoError;
  return null;
}
