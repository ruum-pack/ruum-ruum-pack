"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { avanzarEstadoTraslado, confirmarLlegadaDestino, obtenerPasaporteDigital } from "@ruum/api/services";
import { MapaRutaConduccion } from "./MapaRutaConduccion";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function ConduceADestinoDetails({
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
  
  const destinoCiudad = pasaporte.destino_ciudad || "Ciudad Destino";
  const destinoDireccion = pasaporte.destino_direccion || "Dirección Destino";
  
  const distancia = pasaporte.distancia_km != null ? pasaporte.distancia_km.toFixed(1) : "138.2";
  const tiempoMinutos = pasaporte.tiempo_estimado_horas != null ? Math.round(pasaporte.tiempo_estimado_horas * 60) : 120;

  const navigationTargetLat = pasaporte.destino_lat ?? 16.7569;
  const navigationTargetLng = pasaporte.destino_lng ?? -93.1292;
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${navigationTargetLat},${navigationTargetLng}`;

  async function handleLlegueDestino() {
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      
      const pasaporteFresco = await obtenerPasaporteDigital(cliente, trasladoId);
      const estadoDb = pasaporteFresco?.estado || pasaporte.estado;

      if (estadoDb === "evidencia_final_en_proceso") {
        router.push(`/viajes/${trasladoId}/evidencia`);
        return;
      }

      if (estadoDb === "traslado_en_curso") {
        await confirmarLlegadaDestino(cliente, trasladoId, { fueraGeocerca: false, distanciaM: 0 });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      
      await avanzarEstadoTraslado(cliente, trasladoId, "llegada_a_destino");
      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al destino."));
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
        <div className="w-12 h-12 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-[#3B82F6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-black uppercase tracking-wide">EN TRASLADO</span>
            <span className="h-2 w-2 rounded-full bg-[#3B82F6] animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-6 flex flex-col">
        <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-[28px] font-black leading-tight mt-1">
          Dirígete al destino
        </h2>
        <span className="font-body text-base text-text-secondary mt-1">Conduce con precaución hacia el punto de entrega.</span>
      </div>

      {/* DESTINO */}
      <div className="mt-6 bg-[#0E1524] rounded-[2rem] border border-border/15 p-5 shadow-lg relative">
        <span className="text-[10px] text-[#3B82F6] font-bold uppercase tracking-widest mb-3 block">DESTINO FINAL</span>
        
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <span className="text-[#3B82F6] text-xl">📍</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-black">{destinoCiudad}</span>
              <span className="font-body text-[13px] text-text-secondary leading-snug mt-1 pr-4">{destinoDireccion}</span>
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
             origenLat={navigationTargetLat} origenLng={navigationTargetLng} 
             destinoLat={navigationTargetLat} destinoLng={navigationTargetLng} 
             padding={40} height="120px"
           />
        </div>

        {/* STATS */}
        <div className="mt-5 flex items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center text-text-tertiary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 22L9 2l6 0 6 20M12 2l0 20" strokeDasharray="2 2" /><path d="M6 14h12" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-[#3B82F6] font-bold uppercase tracking-widest">DISTANCIA RESTANTE</span>
              <span className="font-display text-base font-black">{distancia} km</span>
            </div>
          </div>
          <div className="w-px h-10 bg-border/20 mx-4" />
          <div className="flex flex-1 items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-border/20 flex items-center justify-center text-text-tertiary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-[#3B82F6] font-bold uppercase tracking-widest">TIEMPO ESTIMADO</span>
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
            onClick={handleLlegueDestino}
            disabled={procesando}
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-transparent border-2 border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-[#070B14] px-4 py-3.5 font-display text-[13px] font-black tracking-widest uppercase shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1 rounded-full border border-current p-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                HE LLEGADO AL DESTINO
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

      {/* Secondary Bottom Navigation Bar (Detalles del traslado, Gastos, Incidencia) */}
      <div className="mt-auto pt-4 -mx-4 -mb-6">
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      </div>
    </div>
  );
}
