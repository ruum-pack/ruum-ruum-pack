"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import { MapaRutaOrigen } from "./MapaRutaOrigen";

type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export interface DirigeteAOrigenProps {
  trasladoId: string;
  origenDireccion: string;
  origenCiudad: string;
  origenReferencias?: string | null;
  origenLat: number | null;
  origenLng: number | null;
}

/**
 * Pantalla mostrada en el estado conductor_en_camino_al_origen: reemplaza el
 * botón plano por la dirección de recolección, un mapa de ruta y el botón
 * "He llegado" que avanza a conductor_en_punto_de_recoleccion.
 */
export function DirigeteAOrigen({ trasladoId, origenDireccion, origenCiudad, origenReferencias, origenLat, origenLng }: DirigeteAOrigenProps) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destinoTexto = encodeURIComponent(`${origenDireccion}, ${origenCiudad}`);
  const destinoCoordenadas = origenLat !== null && origenLng !== null ? `${origenLat},${origenLng}` : null;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinoCoordenadas ?? `${origenDireccion}, ${origenCiudad}`)}&travelmode=driving`;
  const wazeUrl = destinoCoordenadas
    ? `https://waze.com/ul?ll=${encodeURIComponent(destinoCoordenadas)}&navigate=yes`
    : `https://waze.com/ul?q=${destinoTexto}&navigate=yes`;

  async function heLlegado() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual: EstadoTraslado = "conductor_en_camino_al_origen";
      await avanzarEstadoTraslado(cliente, trasladoId, estadoActual);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar tu llegada. Intenta de nuevo.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-route/25 bg-route-soft/40 p-4">
      <p className="font-mono-ruum text-[10px] uppercase tracking-widest text-route-dark/70">Dirígete al punto de inicio</p>
      <p className="mt-2 font-body text-xs font-semibold text-ink/55">Dirección de recolección</p>
      <p className="mt-1 font-display text-base font-semibold text-ink">{origenDireccion}</p>
      <p className="font-body text-sm text-ink/60">{origenCiudad}</p>
      {origenReferencias && <p className="mt-1 font-body text-xs text-ink/50">Referencias: {origenReferencias}</p>}

      {origenLat !== null && origenLng !== null && (
        <div className="mt-3">
          <MapaRutaOrigen destino={{ lat: origenLat, lng: origenLng }} />
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-route-dark/30 bg-route-soft px-3 py-2 text-center font-body text-sm font-semibold text-route-dark hover:bg-route"
        >
          Abrir en Google Maps
        </a>
        <a
          href={wazeUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-route-dark/30 bg-route-soft px-3 py-2 text-center font-body text-sm font-semibold text-route-dark hover:bg-route"
        >
          Abrir en Waze
        </a>
      </div>

      {error && (
        <div className="mt-3" role="status" aria-live="polite" aria-atomic="true">
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}

      <Button className="mt-4 w-full" onClick={heLlegado} disabled={procesando}>
        {procesando ? TEXTOS_CARGANDO.actualizando : "He llegado"}
      </Button>
    </div>
  );
}
