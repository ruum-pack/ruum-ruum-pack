import { Geolocation } from "@capacitor/geolocation";
import { esNativo } from "./capacitor";

export interface Coordenadas {
  lat: number;
  lng: number;
  precisionM?: number | null;
  velocidadMps?: number | null;
}

export type ResultadoUbicacion =
  | { estado: "ok"; coordenadas: Coordenadas }
  | { estado: "denegado" }
  | { estado: "no_disponible" };

export type CancelarObservacionUbicacion = () => void;

function desdePosicionWeb(posicion: GeolocationPosition): Coordenadas {
  return {
    lat: posicion.coords.latitude,
    lng: posicion.coords.longitude,
    precisionM: posicion.coords.accuracy ?? null,
    velocidadMps: posicion.coords.speed ?? null
  };
}

export function distanciaMetrosEntre(origen: Pick<Coordenadas, "lat" | "lng">, destino: Pick<Coordenadas, "lat" | "lng">) {
  const radioTierraM = 6_371_000;
  const latOrigen = (origen.lat * Math.PI) / 180;
  const latDestino = (destino.lat * Math.PI) / 180;
  const deltaLat = ((destino.lat - origen.lat) * Math.PI) / 180;
  const deltaLng = ((destino.lng - origen.lng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(latOrigen) * Math.cos(latDestino) * Math.sin(deltaLng / 2) ** 2;

  return radioTierraM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * PRD §4.4/§4.15 — coordenadas para etiquetar cada foto de evidencia y para
 * el tracking durante el traslado. Solo primer plano en este corte: tracking
 * en segundo plano real necesita un Foreground Service nativo de Android
 * (ver AndroidManifest.xml y README, sección Pendiente) — no algo que un
 * plugin JS resuelva por sí solo.
 */
export async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  const resultado = await obtenerUbicacionActualConEstado();
  return resultado.estado === "ok" ? resultado.coordenadas : null;
}

export async function obtenerUbicacionActualConEstado(): Promise<ResultadoUbicacion> {
  try {
    if (!esNativo()) {
      if (typeof navigator === "undefined" || !navigator.geolocation) return { estado: "no_disponible" };

      return await new Promise<ResultadoUbicacion>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (posicion) => resolve({ estado: "ok", coordenadas: desdePosicionWeb(posicion) }),
          (error) => resolve(error.code === error.PERMISSION_DENIED ? { estado: "denegado" } : { estado: "no_disponible" }),
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 }
        );
      });
    }

    const permiso = await Geolocation.requestPermissions();
    if (permiso.location === "denied") return { estado: "denegado" };

    const posicion = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return {
      estado: "ok",
      coordenadas: {
        lat: posicion.coords.latitude,
        lng: posicion.coords.longitude,
        precisionM: posicion.coords.accuracy ?? null,
        velocidadMps: posicion.coords.speed ?? null
      }
    };
  } catch {
    return { estado: "no_disponible" };
  }
}

export async function observarUbicacionActual(alCambiar: (ubicacion: Coordenadas) => void): Promise<CancelarObservacionUbicacion | null> {
  try {
    if (!esNativo()) {
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;

      const id = navigator.geolocation.watchPosition(
        (posicion) => alCambiar(desdePosicionWeb(posicion)),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
      );
      return () => navigator.geolocation.clearWatch(id);
    }

    const permiso = await Geolocation.requestPermissions();
    if (permiso.location === "denied") return null;

    const id = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 15_000
      },
      (posicion) => {
        if (!posicion) return;
        alCambiar({
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
          precisionM: posicion.coords.accuracy ?? null,
          velocidadMps: posicion.coords.speed ?? null
        });
      }
    );

    return () => {
      void Geolocation.clearWatch({ id });
    };
  } catch {
    return null;
  }
}
