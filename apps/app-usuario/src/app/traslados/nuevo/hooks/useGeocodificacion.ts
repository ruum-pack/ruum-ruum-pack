import { geocodificarDireccion } from "../../../../lib/mapbox";

export function useGeocodificacion() {
  async function geocodificarRuta(origen: string, destino: string, origenActual?: { lat: number; lng: number }) {
    const [origenResuelto, destinoResuelto] = await Promise.all([
      origenActual ? Promise.resolve(origenActual) : geocodificarDireccion(origen),
      geocodificarDireccion(destino)
    ]);
    return {
      origenLat: origenResuelto?.lat, origenLng: origenResuelto?.lng,
      destinoLat: destinoResuelto?.lat, destinoLng: destinoResuelto?.lng,
      incompletas: !origenResuelto || !destinoResuelto
    };
  }
  return { geocodificarRuta };
}
