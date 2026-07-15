"use client";

import { useEffect, useState } from "react";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";
import { construirUrlMapaRutaOrigen, tieneMapboxConfigurado, type PuntoMapa } from "../../../lib/mapbox-rutas";

export interface MapaRutaOrigenProps {
  destino: PuntoMapa;
}

/**
 * Mapa estático hacia el punto de recolección. Intenta ubicar al conductor
 * (obtenerUbicacionActual solo funciona en el shell nativo, PRD §4.15) para
 * dibujar la ruta completa; si no hay ubicación o no hay token de Mapbox,
 * se degrada a mostrar solo el pin de destino o nada (la dirección en texto
 * sigue visible en la pantalla que envuelve a este componente).
 */
export function MapaRutaOrigen({ destino }: MapaRutaOrigenProps) {
  const [urlMapa, setUrlMapa] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      if (!tieneMapboxConfigurado()) {
        setCargando(false);
        return;
      }
      const ubicacion = await obtenerUbicacionActual();
      const url = await construirUrlMapaRutaOrigen(destino, ubicacion);
      if (!cancelado) {
        setUrlMapa(url);
        setCargando(false);
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino.lat, destino.lng]);

  if (cargando) {
    return <div className="h-40 w-full animate-pulse rounded-xl bg-ink/8" aria-hidden />;
  }

  if (!urlMapa) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen remota de Mapbox Static API, no un asset local optimizable.
    <img
      src={urlMapa}
      alt="Mapa de la ruta hacia el punto de recolección"
      className="h-40 w-full rounded-xl border border-ink/10 object-cover"
    />
  );
}
