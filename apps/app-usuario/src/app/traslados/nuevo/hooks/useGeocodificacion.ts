import { useCallback, useRef } from "react";
import { calcularRutaMapbox, calcularRutaMapboxConParadas, geocodificarDireccion } from "../../../../lib/mapbox";

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
    async (origen: string, destino: string, origenActual?: { lat: number; lng: number }, signal?: AbortSignal) => {
      if (signal?.aborted) return { origenLat: undefined, origenLng: undefined, destinoLat: undefined, destinoLng: undefined, distanciaKm: undefined, tiempoEstimadoHoras: undefined, incompletas: true as const };
      const [origenResuelto, destinoResuelto] = await Promise.all([
        origenActual ? Promise.resolve(origenActual) : geocodificarDireccion(origen, signal),
        geocodificarDireccion(destino, signal)
      ]);
      if (signal?.aborted) return { origenLat: origenResuelto?.lat, origenLng: origenResuelto?.lng, destinoLat: destinoResuelto?.lat, destinoLng: destinoResuelto?.lng, distanciaKm: undefined, tiempoEstimadoHoras: undefined, incompletas: true as const };
      const ruta = origenResuelto && destinoResuelto ? await calcularRutaMapbox(origenResuelto, destinoResuelto, signal) : null;
      return {
        origenLat: origenResuelto?.lat, origenLng: origenResuelto?.lng,
        destinoLat: destinoResuelto?.lat, destinoLng: destinoResuelto?.lng,
        distanciaKm: ruta?.distanciaKm,
        tiempoEstimadoHoras: ruta?.tiempoEstimadoHoras,
        incompletas: !origenResuelto || !destinoResuelto || !ruta
      };
    },
    []
  );
  const geocodificarRutaConParadas = useCallback(
    async (origen: string, destino: string, paradas: string[], origenActual?: { lat: number; lng: number }, signal?: AbortSignal) => {
      if (signal?.aborted) return { origenLat: undefined, origenLng: undefined, destinoLat: undefined, destinoLng: undefined, paradasCoords: paradas.map(() => ({} as { lat: number; lng: number })), distanciaKm: undefined, tiempoEstimadoHoras: undefined, incompletas: true as const };
      const [origenResuelto, destinoResuelto, ...paradasResueltas] = await Promise.all([
        origenActual ? Promise.resolve(origenActual) : geocodificarDireccion(origen, signal),
        geocodificarDireccion(destino, signal),
        ...paradas.map((p) => geocodificarDireccion(p, signal))
      ]);
      if (signal?.aborted) return { origenLat: origenResuelto?.lat, origenLng: origenResuelto?.lng, destinoLat: destinoResuelto?.lat, destinoLng: destinoResuelto?.lng, paradasCoords: paradasResueltas.map((p) => (p ? { lat: p.lat, lng: p.lng } : {} as { lat: number; lng: number })), distanciaKm: undefined, tiempoEstimadoHoras: undefined, incompletas: true as const };
      const todasResueltas = origenResuelto && destinoResuelto && paradasResueltas.every(Boolean);
      let ruta = null;
      if (origenResuelto && destinoResuelto) {
        if (paradasResueltas.length > 0 && paradasResueltas.every(Boolean)) {
          ruta = await calcularRutaMapboxConParadas(origenResuelto, destinoResuelto, paradasResueltas as { lat: number; lng: number }[], signal);
        } else if (paradasResueltas.length === 0) {
          ruta = await calcularRutaMapbox(origenResuelto, destinoResuelto, signal);
        }
      }
      return {
        origenLat: origenResuelto?.lat, origenLng: origenResuelto?.lng,
        destinoLat: destinoResuelto?.lat, destinoLng: destinoResuelto?.lng,
        paradasCoords: paradasResueltas.map((p) => (p ? { lat: p.lat, lng: p.lng } : {})),
        distanciaKm: ruta?.distanciaKm,
        tiempoEstimadoHoras: ruta?.tiempoEstimadoHoras,
        incompletas: !todasResueltas || !ruta
      };
    },
    []
  );
  return { geocodificarRuta, geocodificarRutaConParadas };
}

// 1.4 Debounce dinámico — inmediato en onBlur, 650ms en onChange
export function useGeocodificacionDinamica() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geocodificarDireccionDinamica = useCallback((direccion: string, isOnBlur = false) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const delay = isOnBlur ? 0 : 650;
    timeoutRef.current = setTimeout(() => {
      void geocodificarDireccion(direccion);
    }, delay);
  }, []);

  return { geocodificarDireccionDinamica };
}
