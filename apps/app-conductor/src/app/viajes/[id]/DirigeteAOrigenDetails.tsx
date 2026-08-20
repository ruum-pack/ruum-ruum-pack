"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado } from "@ruum/api/services";
import { MapaRutaConduccion } from "./MapaRutaConduccion";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export function DirigeteAOrigenDetails({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const trasladoId = pasaporte.traslado_id!;
  
  const origenCiudad = pasaporte.origen_ciudad || "San Mateo Atenco";
  const origenDireccion = pasaporte.origen_direccion || "Av. Lerma 300, San Mateo Atenco, Estado de México, 52105";
  
  const distancia = pasaporte.distancia_km != null ? pasaporte.distancia_km.toFixed(1) : "4.2";
  const tiempoMinutos = pasaporte.tiempo_estimado_horas != null ? Math.round(pasaporte.tiempo_estimado_horas * 60) : 9;

  const navigationTargetLat = pasaporte.origen_lat ?? 19.2811;
  const navigationTargetLng = pasaporte.origen_lng ?? -99.5312;
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${navigationTargetLat},${navigationTargetLng}`;

  async function handleLlegueOrigen() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_camino_al_origen");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al origen."));
      setProcesando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md bg-[#070B14] min-h-[calc(100vh-100px)] flex flex-col text-white pb-6 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4 border-b border-border/10">
        <Link href={volver} className="p-2 -ml-2 text-text-tertiary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </Link>
        <span className="font-display text-[13px] font-black uppercase tracking-widest">TRASLADO ACTIVO</span>
        <button type="button" className="p-2 -mr-2 text-text-tertiary relative">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
        </button>
      </header>

      {/* ESTADO ACTUAL */}
      <div className="mt-5 bg-[#0E1524] border border-border/20 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-black uppercase tracking-wide">EN CAMINO AL ORIGEN</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-6 flex flex-col">
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-[28px] font-black leading-tight mt-1">
          Dirígete al origen
        </h2>
        <span className="font-body text-base text-text-secondary mt-1">para recoger el vehículo</span>
      </div>

      {/* ORIGEN */}
      <div className="mt-6 bg-[#0E1524] rounded-[2rem] border border-border/15 p-5 shadow-lg relative">
        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-3 block">ORIGEN</span>
        
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <span className="text-emerald-400 text-xl">📍</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-black">{origenCiudad}</span>
              <span className="font-body text-[13px] text-text-secondary leading-snug mt-1 pr-4">{origenDireccion}</span>
            </div>
          </div>
          <a href={navigationUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors shrink-0">
            <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center border border-border/20 shadow-xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            </div>
            <span className="text-[9px] font-medium tracking-wider">Ver en mapa</span>
          </a>
        </div>

        {/* MAP PREVIEW */}
        <div className="mt-5 rounded-xl overflow-hidden h-[120px] bg-surface relative pointer-events-none">
           <MapaRutaConduccion
             origen={{ lat: navigationTargetLat, lng: navigationTargetLng }}
             destino={{ lat: navigationTargetLat, lng: navigationTargetLng }}
           />
        </div>

        {/* STATS */}
        <div className="mt-5 flex items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center text-text-tertiary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 22L9 2l6 0 6 20M12 2l0 20" strokeDasharray="2 2" /><path d="M6 14h12" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">DISTANCIA</span>
              <span className="font-display text-base font-black">{distancia} km</span>
            </div>
          </div>
          <div className="w-px h-10 bg-border/20 mx-4" />
          <div className="flex flex-1 items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center text-text-tertiary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">TIEMPO ESTIMADO</span>
              <span className="font-display text-base font-black">{tiempoMinutos} min</span>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col gap-3">
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[#00B4D8] hover:bg-[#0092B0] px-4 py-3.5 font-display text-[13px] font-black tracking-widest text-white uppercase shadow-md active:scale-[0.98] transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-1"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
            <div className="flex flex-col items-center leading-none">
              <span>NAVEGAR</span>
              <span className="text-[8px] font-medium tracking-wide mt-0.5 opacity-90 normal-case">Google Maps ⌄</span>
            </div>
          </a>

          <button
            type="button"
            onClick={handleLlegueOrigen}
            disabled={procesando}
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-transparent border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-[#070B14] px-4 py-3.5 font-display text-[13px] font-black tracking-widest uppercase shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1 rounded-full border border-current p-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                HE LLEGADO AL ORIGEN
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}

      {/* Ver detalles link */}
      <div className="mt-auto pt-6 flex justify-center pb-2">
        <Link
          href={`/viajes/${trasladoId}/detalles`}
          className="flex items-center gap-2 bg-[#0E1524] border border-border/15 rounded-xl px-4 py-3 w-full hover:bg-surface transition-colors font-body text-sm text-text-primary shadow-xs"
        >
          <svg className="text-text-tertiary" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          <span className="flex-1 font-semibold text-text-primary">Ver detalles del traslado</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-tertiary"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      </div>

    </div>
  );
}
