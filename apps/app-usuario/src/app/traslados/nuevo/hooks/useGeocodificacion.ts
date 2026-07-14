import { useCallback } from "react";
import { calcularRutaMapbox, geocodificarDireccion } from "../../../../lib/mapbox";

export function useGeocodificacion() {
  // useCallback con deps vacías: geocodificarRuta debe mantener la misma
  // identidad entre renders. Antes se recreaba en cada render de
  // NuevoTrasladoForm y, como es dependencia del useEffect que dispara el
  // cálculo de ruta, cada setRutaCalculando/setRutaEstimacion (que el propio
  // efecto dispara) generaba un nuevo render -> nueva función -> el efecto se
  // cancelaba y volvía a arrancar antes de que el debounce de 650ms pudiera
  // completarse. Resultado: "Calculando ruta..." parpadeando sin fin y
  // distancia/tiempo que nunca llegaban a mostrarse.
  const geocodificarRuta = useCallback(
    async (origen: string, destino: string, origenActual?: { lat: number; lng: number }) => {
      const [origenResuelto, destinoResuelto] = await Promise.all([
        origenActual ? Promise.resolve(origenActual) : geocodificarDireccion(origen),
        geocodificarDireccion(destino)
      ]);
      const ruta = origenResuelto && destinoResuelto ? await calcularRutaMapbox(origenResuelto, destinoResuelto) : null;
      return {
        origenLat: origenResuelto?.lat, origenLng: origenResuelto?.lng,
        destinoLat: destinoResuelto?.lat, destinoLng: destinoResuelto?.lng,
        distanciaKm: ruta?.distanciaKm,
        tiempoEstimadoHoras: ruta?.tiempoEstimadoHoras,
        incompletas: !origenResuelto || !destinoResuelto
      };
    },
    []
  );
  return { geocodificarRuta };
}
