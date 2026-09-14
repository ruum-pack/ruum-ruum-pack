/**
 * Fachada: la implementación vive en `@ruum/api/ubicacion` (fuente única).
 * app-usuario conserva su comportamiento legacy: solo shell nativo, en web
 * devuelve `null` sin pedir permiso de geolocalización.
 */
import {
  obtenerUbicacionActual as obtenerUbicacionCompartida,
  type Coordenadas as CoordenadasCompartidas
} from "@ruum/api/ubicacion";

export type Coordenadas = Pick<CoordenadasCompartidas, "lat" | "lng">;

export function obtenerUbicacionActual(): Promise<Coordenadas | null> {
  return obtenerUbicacionCompartida({ soloNativo: true });
}
