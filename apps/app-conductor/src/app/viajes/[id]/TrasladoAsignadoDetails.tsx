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

export function TrasladoAsignadoDetails({
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
  
  const origenCiudad = pasaporte.origen_ciudad || "Ciudad Origen";
  const origenDireccion = pasaporte.origen_direccion || "Dirección Origen";
  
  const navigationTargetLat = pasaporte.origen_lat ?? 19.4326;
  const navigationTargetLng = pasaporte.origen_lng ?? -99.1332;

  async function handleIniciarCamino() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, "conductor_asignado");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar el traslado."));
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-black uppercase tracking-wide">ASIGNADO</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-6 flex flex-col">
        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-[28px] font-black leading-tight mt-1">
          Prepárate para salir
        </h2>
        <span className="font-body text-base text-text-secondary mt-1">Cuando estés listo, inicia tu camino al punto de origen.</span>
      </div>

      {/* ORIGEN */}
      <div className="mt-6 bg-[#0E1524] rounded-[2rem] border border-border/15 p-5 shadow-lg relative">
        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-3 block">PUNTO DE RECOLECCIÓN</span>
        
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
        </div>

        {/* MAP PREVIEW */}
        <div className="mt-5 rounded-xl overflow-hidden h-[120px] bg-surface relative pointer-events-none opacity-80">
           <MapaRutaConduccion
             origen={{ lat: navigationTargetLat, lng: navigationTargetLng }}
             destino={{ lat: navigationTargetLat, lng: navigationTargetLng }}
           />
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleIniciarCamino}
            disabled={procesando}
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-emerald-500 hover:bg-emerald-600 px-4 py-3.5 font-display text-[13px] font-black tracking-widest text-[#070B14] uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                ESTOY EN CAMINO AL ORIGEN
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-1"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
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
