"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ETIQUETA_TIPO_VEHICULO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { nombreVehiculo } from "../../trips-utils";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

type TabId = "itinerario" | "vehiculo" | "pago" | "info";

export function TripDetailsTabs({ pasaporte }: { pasaporte: PasaporteRow }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("itinerario");
  
  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();
  
  const origenCiudad = pasaporte.origen_ciudad || "Ciudad de Origen";
  const origenDir = pasaporte.origen_direccion || "Dirección pendiente";
  const destinoCiudad = pasaporte.destino_ciudad || "Ciudad Destino";
  const destinoDir = pasaporte.destino_direccion || "Dirección pendiente";
  const distancia = pasaporte.distancia_km != null ? `${pasaporte.distancia_km.toFixed(1)} km` : "Por confirmar";
  const tiempoEstimado = pasaporte.tiempo_estimado_horas != null 
    ? `${Math.round(pasaporte.tiempo_estimado_horas * 60)} min` 
    : "Por confirmar";
  
  const vehiculo = nombreVehiculo(pasaporte);
  const placas = pasaporte.vehiculo_placas || "POR ASIGNAR";
  const color = pasaporte.vehiculo_color || "No especificado";
  const vin = pasaporte.vehiculo_vin || "POR CONFIRMAR";
  const tipoVehiculo = pasaporte.vehiculo_tipo ? ETIQUETA_TIPO_VEHICULO[pasaporte.vehiculo_tipo] : "Traslado vehicular";
  
  const pagoTotal = pasaporte.ganancia_conductor || 0;
  const fecha = pasaporte.creado_en ? new Date(pasaporte.creado_en).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "Fecha pendiente";

  return (
    <div className="mx-auto w-full max-w-md bg-surface min-h-screen flex flex-col text-text-primary pb-6 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4 border-b border-border/15">
        <Link href={`/viajes/${trasladoId}`} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-surface-elevated">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </Link>
        <span className="font-display text-xs font-black uppercase tracking-widest text-text-primary">DETALLES DEL TRASLADO</span>
        <div className="w-10" />
      </header>

      {/* TABS */}
      <div className="mt-4 flex w-full rounded-full border border-border/20 bg-surface-elevated p-1 select-none overflow-x-auto no-scrollbar">
        {[
          { id: "itinerario", label: "Ruta" },
          { id: "vehiculo", label: "Vehículo" },
          { id: "pago", label: "Pago" },
          { id: "info", label: "Protocolo" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`flex-1 rounded-full px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer min-w-max ${
              activeTab === tab.id
                ? "bg-route-action text-slate-950 shadow-md"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="mt-5 flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "itinerario" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="flex flex-col items-center mt-1">
                <span className="h-3 w-3 rounded-full border-2 border-emerald-400 bg-transparent shrink-0" />
                <div className="w-[1px] h-10 bg-border/40 my-1" />
                <span className="h-3 w-3 rounded-full bg-route-action shrink-0 block" />
              </div>
              <div className="flex flex-col justify-between py-0.5 min-w-0">
                <div className="flex flex-col mb-3">
                  <span className="font-display text-[9px] font-bold text-emerald-400 tracking-widest uppercase">PUNTO DE RECOLECCIÓN</span>
                  <span className="font-display text-base font-black text-text-primary leading-tight mt-0.5">{origenCiudad}</span>
                  <span className="font-body text-xs text-text-secondary mt-0.5 leading-snug">{origenDir}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-[9px] font-bold text-route-action tracking-widest uppercase">PUNTO DE ENTREGA</span>
                  <span className="font-display text-base font-black text-text-primary leading-tight mt-0.5">{destinoCiudad}</span>
                  <span className="font-body text-xs text-text-secondary mt-0.5 leading-snug">{destinoDir}</span>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Distancia estimada</span>
                <span className="font-display text-base font-black text-text-primary mt-0.5 tabular-nums">{distancia}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tiempo estimado</span>
                <span className="font-display text-base font-black text-text-primary mt-0.5 tabular-nums">{tiempoEstimado}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vehiculo" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-4">
             <div className="flex items-center justify-between">
               <div className="flex flex-col">
                 <span className="text-[10px] text-text-tertiary font-extrabold uppercase tracking-widest">Unidad a trasladar</span>
                 <span className="font-display text-lg font-black text-text-primary mt-0.5">{vehiculo}</span>
               </div>
               <div className="border border-border/30 bg-surface px-2.5 py-1 rounded-lg">
                 <span className="font-mono text-xs font-black tracking-widest text-text-primary">{placas}</span>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-3 mt-1">
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Color</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary">{color}</span>
               </div>
               <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Tipo</span>
                 <span className="font-semibold text-xs mt-0.5 text-text-primary">{tipoVehiculo}</span>
               </div>
               <div className="flex flex-col col-span-2 bg-surface p-3 rounded-xl border border-border/15">
                 <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">VIN / Número de Serie</span>
                 <span className="font-mono text-xs font-black mt-0.5 text-text-primary truncate">{vin}</span>
               </div>
             </div>

             <div className="h-px w-full bg-border/20 my-1" />
             
             <div className="flex flex-col gap-2">
               <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Garantía de Evidencia Ruum Ruum</span>
               <div className="p-3 bg-surface rounded-xl border border-border/15 flex items-center gap-2.5">
                 <span className="text-base">🛡️</span>
                 <span className="text-[11px] text-text-secondary leading-snug">
                   Inspección 360° fotográfica obligatoria antes de iniciar y al concluir la entrega.
                 </span>
               </div>
             </div>
          </div>
        )}

        {activeTab === "pago" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-5">
            <div className="flex flex-col items-center p-4 bg-surface rounded-2xl border border-border/20 text-center">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Ganancia Neta Conductor</span>
              <div className="flex items-start mt-1">
                <span className="text-lg font-bold text-signal mr-1 mt-0.5">$</span>
                <span className="font-display text-4xl font-black text-signal tabular-nums">
                  {pagoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[11px] text-text-secondary mt-1 font-semibold">Tarifa garantizada por entrega completada</span>
            </div>

            <div className="h-px w-full bg-border/20 my-0.5" />

            <div className="flex justify-between items-center bg-surface p-3 rounded-xl border border-border/15">
              <div className="flex flex-col">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Modalidad de Dispersión</span>
                <span className="font-semibold text-xs text-text-primary mt-0.5">Transferencia Bancaria SPEI</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Acreditación</span>
                <span className="text-xs font-black text-signal mt-0.5">Al Cierre Operativo</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "info" && (
          <div className="bg-surface-elevated rounded-3xl border border-border/20 p-5 shadow-sm relative flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Folio de Traslado</span>
                <span className="font-mono text-base font-black text-text-primary mt-0.5">{folio}</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-surface border border-border/30 text-[10px] font-bold text-route-action uppercase">
                Certificado
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Operador Responsable</span>
                <span className="font-semibold text-xs text-text-primary mt-0.5">Ruum Ruum by MoviliaX</span>
              </div>
              <div className="flex flex-col bg-surface p-3 rounded-xl border border-border/15">
                <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-widest">Fecha de Registro</span>
                <span className="font-semibold text-xs text-text-primary mt-0.5 capitalize">{fecha}</span>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />
            
            <div className="flex flex-col bg-surface p-3.5 rounded-xl border border-border/15">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Lema Oficial de Operación</span>
              <span className="font-display text-xs font-bold text-text-primary mt-1 leading-relaxed">
                "Seguridad, evidencia y trazabilidad en cada viaje."
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
