import { Geolocation } from "@capacitor/geolocation";
import { esNativo } from "./capacitor";

export interface Coordenadas {
  lat: number;
  lng: number;
  precisionM?: number | null;
  velocidadMps?: number | null;
}

/**
 * PRD §4.4/§4.15 — coordenadas para etiquetar cada foto de evidencia y para
 * el tracking durante el traslado. Solo primer plano en este corte: tracking
 * en segundo plano real necesita un Foreground Service nativo de Android
 * (ver AndroidManifest.xml y README, sección Pendiente) — no algo que un
 * plugin JS resuelva por sí solo.
 */
export async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  if (!esNativo()) return null;

  try {
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
