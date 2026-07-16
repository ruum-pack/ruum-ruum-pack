import { Geolocation } from "@capacitor/geolocation";
import { esNativo } from "./capacitor";

export interface Coordenadas {
  lat: number;
  lng: number;
  precisionM?: number | null;
  velocidadMps?: number | null;
}

export type CancelarObservacionUbicacion = () => void;

function desdePosicionWeb(posicion: GeolocationPosition): Coordenadas {
  return {
    lat: posicion.coords.latitude,
    lng: posicion.coords.longitude,
    precisionM: posicion.coords.accuracy ?? null,
    velocidadMps: posicion.coords.speed ?? null
  };
}

/**
 * PRD §4.4/§4.15 — coordenadas para etiquetar cada foto de evidencia y para
 * el tracking durante el traslado. Solo primer plano en este corte: tracking
 * en segundo plano real necesita un Foreground Service nativo de Android
 * (ver AndroidManifest.xml y README, sección Pendiente) — no algo que un
 * plugin JS resuelva por sí solo.
 */
export async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  try {
    if (!esNativo()) {
      if (typeof navigator === "undefined" || !navigator.geolocation) return null;

      return await new Promise<Coordenadas | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (posicion) => resolve(desdePosicionWeb(posicion)),
          () => resolve(null),
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 }
        );
      });
    }

    const permiso = await Geolocation.requestPermissions();
    if (permiso.location === "denied") return null;

    const posicion = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return {
      lat: posicion.coords.latitude,
      lng: posicion.coords.longitude,
      precisionM: posicion.coords.accuracy ?? null,
      velocidadMps: posicion.coords.speed ?? null
    };
  } catch {
    return null;
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
