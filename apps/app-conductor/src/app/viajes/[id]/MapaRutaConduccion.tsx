"use client";

import { useEffect, useState } from "react";
import { obtenerUbicacionActual } from "../../../lib/ubicacion";
import {
  construirUrlMapaRutaConduccion,
  tieneMapboxConfigurado,
  type PuntoMapa
} from "../../../lib/mapbox-rutas";

export interface MapaRutaConduccionProps {
  origen: PuntoMapa;
  destino: PuntoMapa;
}

export function MapaRutaConduccion({ origen, destino }: MapaRutaConduccionProps) {
  const [urlMapa, setUrlMapa] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      if (!tieneMapboxConfigurado()) {
        setCargando(false);
        return;
      }
      try {
        // Try getting current location. If unavailable, fallback to null.
        const ubicacion = await obtenerUbicacionActual().catch(() => null);
        const url = await construirUrlMapaRutaConduccion(origen, destino, ubicacion);
        if (!cancelado) {
          setUrlMapa(url);
          setCargando(false);
        }
      } catch (err) {
        console.error("Error al construir mapa de ruta de conducción:", err);
        if (!cancelado) {
          setCargando(false);
        }
      }
    }
    void cargar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origen.lat, origen.lng, destino.lat, destino.lng]);

  if (cargando) {
    return (
      <div className="h-44 w-full animate-pulse rounded-xl bg-surface-elevated/45 border border-border/10 flex items-center justify-center text-text-tertiary font-body text-xs" aria-hidden>
        Cargando mapa interactivo...
      </div>
    );
  }

  if (!urlMapa) {
    // OSM / Leaflet / or static fallback placeholder if Mapbox is not configured
    return (
      <div className="h-44 w-full bg-surface-elevated/45 rounded-xl flex flex-col items-center justify-center border border-border/10 relative overflow-hidden">
        {/* Simple visual path fallback */}
        <svg width="100%" height="100%" className="absolute inset-0 select-none opacity-20 pointer-events-none" aria-hidden="true">
          <path d="M 30 130 Q 120 40 210 120 T 370 50" fill="none" stroke="#00B4D8" strokeWidth="4" strokeDasharray="8, 8" />
        </svg>
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg z-10">
          📍
        </div>
        <span className="font-display text-xs font-bold text-text-secondary mt-2 z-10">Ruta de conducción activa</span>
        <span className="font-body text-[10px] text-text-tertiary z-10">{origen.lat.toFixed(4)}, {origen.lng.toFixed(4)} ➔ {destino.lat.toFixed(4)}, {destino.lng.toFixed(4)}</span>
      </div>
    );
  }

  return (
    <div className="h-44 w-full rounded-xl border border-border/30 overflow-hidden relative">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen estática externa de Mapbox */}
      <img
        src={urlMapa}
        alt="Mapa del trayecto desde origen hasta el destino del traslado"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
