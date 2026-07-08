import { Geolocation } from "@capacitor/geolocation";
import { esNativo } from "./capacitor";

export interface Coordenadas {
  lat: number;
  lng: number;
}

/**
 * Reemplazo real del placeholder lat/lng=0 del wizard cuando corre en el
 * shell nativo (ver traslados/nuevo/page.tsx). Geocodificación real
 * (dirección → coordenadas) sigue pendiente — esto solo cubre "dónde está
 * el dispositivo ahora", útil para el origen, no para el destino.
 */
export async function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  if (!esNativo()) return null;

  try {
    const permiso = await Geolocation.requestPermissions();
    if (permiso.location === "denied") return null;

    const posicion = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return { lat: posicion.coords.latitude, lng: posicion.coords.longitude };
  } catch {
    return null;
  }
}
