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
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function LocalizarVehiculoDetails({
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
  
  const placas = pasaporte.vehiculo_placas || "POR CONFIRMAR";
  const vin = pasaporte.vehiculo_vin || "POR CONFIRMAR";
  const contactoNombre = pasaporte.contacto_entrega_nombre || "Contacto Origen";
  const contactoTelefono = pasaporte.contacto_entrega_telefono || "0000000000";

  async function handleIniciarInspeccion() {
    setProcesando(true);
    setError(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual = (pasaporte.estado || "conductor_en_punto_de_recoleccion") as EstadoTraslado;
      
      if (estadoActual === "conductor_en_punto_de_recoleccion") {
        const siguiente = (await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_punto_de_recoleccion")) as EstadoTraslado;
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, siguiente);
      } else if (estadoActual === "verificacion_vehiculo_en_proceso") {
        await avanzarEstadoTraslado(cliente, trasladoId, "verificacion_vehiculo_en_proceso");
      }
      
      router.push(`/viajes/${trasladoId}/evidencia`);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar la verificación del vehículo."));
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
        <div className="w-12 h-12 rounded-full bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-[#A855F7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-text-tertiary font-bold tracking-widest uppercase mb-0.5">ESTADO ACTUAL</span>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-black uppercase tracking-wide">EN EL ORIGEN</span>
            <span className="h-2 w-2 rounded-full bg-[#A855F7] animate-pulse mt-0.5" />
          </div>
        </div>
      </div>

      {/* TU PRÓXIMA ACCIÓN */}
      <div className="mt-6 flex flex-col">
        <span className="text-[10px] font-bold text-[#A855F7] uppercase tracking-widest">TU PRÓXIMA ACCIÓN</span>
        <h2 className="font-display text-[28px] font-black leading-tight mt-1">
          Recibe el vehículo
        </h2>
        <span className="font-body text-base text-text-secondary mt-1">Localiza la unidad e inicia la inspección física.</span>
      </div>

      {/* ORIGEN CONTACTO */}
      <div className="mt-6 bg-[#0E1524] rounded-[2rem] border border-border/15 p-5 shadow-lg relative">
        <span className="text-[10px] text-[#A855F7] font-bold uppercase tracking-widest mb-3 block">CONTACTO DE RECOLECCIÓN</span>
        
        <div className="flex items-center justify-between bg-surface-elevated rounded-xl p-3 border border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00B4D8]/10 text-[#00B4D8] flex items-center justify-center font-bold text-lg">
              {contactoNombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">{contactoNombre}</span>
              <span className="text-xs text-text-secondary">{contactoTelefono}</span>
            </div>
          </div>
          <a href={`tel:${contactoTelefono.replace(/\s+/g, '')}`} className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 active:scale-95 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </a>
        </div>

        {/* VEHÍCULO A BUSCAR */}
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">VEHÍCULO A LOCALIZAR</span>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-surface-elevated border border-border/20 rounded-xl p-3 flex flex-col">
              <span className="text-[9px] text-text-tertiary uppercase font-bold">PLACAS</span>
              <span className="font-display font-black text-lg mt-0.5">{placas}</span>
            </div>
            <div className="flex-1 bg-surface-elevated border border-border/20 rounded-xl p-3 flex flex-col">
              <span className="text-[9px] text-text-tertiary uppercase font-bold">VIN</span>
              <span className="font-display font-black text-sm mt-1 uppercase truncate">{vin}</span>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleIniciarInspeccion}
            disabled={procesando}
            className="flex w-full items-center justify-center gap-2 rounded-[1rem] bg-[#A855F7] hover:bg-[#9333EA] px-4 py-3.5 font-display text-[13px] font-black tracking-widest text-white uppercase shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {procesando ? (
              TEXTOS_CARGANDO.actualizando
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15L11 17L15 13" /></svg>
                INICIAR INSPECCIÓN
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
