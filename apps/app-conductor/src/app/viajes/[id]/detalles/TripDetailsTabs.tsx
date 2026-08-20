"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database } from "@ruum/shared/types";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

type TabId = "itinerario" | "vehiculo" | "pago" | "info";

export function TripDetailsTabs({ pasaporte }: { pasaporte: PasaporteRow }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("itinerario");
  
  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();
  
  // Destructure with fallbacks to avoid crashes
  const origenCiudad = pasaporte.origen_ciudad || "Ciudad de Origen";
  const origenDir = pasaporte.origen_direccion || "Dirección pendiente";
  const destinoCiudad = pasaporte.destino_ciudad || "Ciudad Destino";
  const destinoDir = pasaporte.destino_direccion || "Dirección pendiente";
  const distancia = (pasaporte.distancia_km || 0).toFixed(1);
  const tiempoEstimado = pasaporte.tiempo_estimado_horas != null 
    ? Math.round(pasaporte.tiempo_estimado_horas * 60) 
    : 0;
  
  const vehiculo = `${pasaporte.vehiculo_marca || "Auto"} ${pasaporte.vehiculo_modelo || ""} ${pasaporte.vehiculo_anio || ""}`.trim();
  const placas = pasaporte.vehiculo_placas || "SIN PLACAS";
  const color = pasaporte.vehiculo_color || "Por confirmar";
  
  const pagoTotal = pasaporte.ganancia_conductor || 0;
  const fecha = pasaporte.creado_en ? new Date(pasaporte.creado_en).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "Fecha pendiente";

  return (
    <div className="mx-auto w-full max-w-md bg-[#070B14] min-h-screen flex flex-col text-white pb-6 px-4">
      {/* HEADER */}
      <header className="flex items-center justify-between py-4 border-b border-border/10">
        <Link href={`/viajes/${trasladoId}`} className="p-2 -ml-2 text-text-tertiary hover:text-text-primary transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </Link>
        <span className="font-display text-[13px] font-black uppercase tracking-widest text-text-secondary">DETALLES DEL TRASLADO</span>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* TABS */}
      <div className="mt-4 flex w-full rounded-full border border-border/10 bg-[#0E1524] p-1 select-none overflow-x-auto no-scrollbar">
        {[
          { id: "itinerario", label: "Ruta" },
          { id: "vehiculo", label: "Vehículo" },
          { id: "pago", label: "Pago" },
          { id: "info", label: "Info" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`flex-1 rounded-full px-3 py-2 text-center text-[10px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer min-w-max ${
              activeTab === tab.id
                ? "bg-[#00B4D8] text-white shadow-md scale-[1.02]"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="mt-6 flex-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "itinerario" && (
          <div className="bg-[#0E1524] rounded-3xl border border-border/15 p-5 shadow-lg relative flex flex-col gap-5">
            <div className="flex gap-4">
              <div className="flex flex-col items-center mt-1">
                <span className="text-emerald-400 text-xl">📍</span>
                <div className="w-px h-10 bg-border/30 my-1" />
                <span className="text-rose-400 text-xl">📍</span>
              </div>
              <div className="flex flex-col justify-between py-1">
                <div className="flex flex-col mb-4">
                  <span className="font-display text-lg font-black leading-none">{origenCiudad}</span>
                  <span className="font-body text-xs text-text-secondary mt-1 leading-snug">{origenDir}</span>
                </div>
                <div className="flex flex-col mt-3">
                  <span className="font-display text-lg font-black leading-none">{destinoCiudad}</span>
                  <span className="font-body text-xs text-text-secondary mt-1 leading-snug">{destinoDir}</span>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Distancia total</span>
                <span className="font-display text-lg font-black mt-0.5">{distancia} km</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tiempo est. total</span>
                <span className="font-display text-lg font-black mt-0.5">{tiempoEstimado} min</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vehiculo" && (
          <div className="bg-[#0E1524] rounded-3xl border border-border/15 p-5 shadow-lg relative flex flex-col gap-4">
             <div className="flex flex-col">
               <span className="font-display text-xl font-black">{vehiculo}</span>
               <div className="mt-2 inline-flex self-start border border-border/20 bg-surface px-3 py-1 rounded-md">
                 <span className="font-display text-xs font-black tracking-widest">{placas}</span>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-4 mt-2">
               <div className="flex flex-col">
                 <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Color</span>
                 <span className="font-medium text-sm mt-0.5">{color}</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tipo</span>
                 <span className="font-medium text-sm mt-0.5">Sedán</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Combustible</span>
                 <span className="font-medium text-sm mt-0.5">Gasolina</span>
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Transmisión</span>
                 <span className="font-medium text-sm mt-0.5">Automática</span>
               </div>
             </div>

             <div className="h-px w-full bg-border/20 my-2" />
             
             <div className="flex flex-col">
               <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest mb-3">Evidencia</span>
               <div className="flex flex-col gap-2.5">
                 {['Fotos del vehículo', 'Kilometraje inicial', 'Nivel de combustible', 'Documentación'].map((item, i) => (
                   <div key={item} className="flex items-center justify-between">
                     <span className="text-sm font-medium text-text-secondary">{item}</span>
                     <span className="text-xs font-bold text-emerald-400">Pendiente</span>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        )}

        {activeTab === "pago" && (
          <div className="bg-[#0E1524] rounded-3xl border border-border/15 p-5 shadow-lg relative flex flex-col gap-5">
            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Pago total</span>
                <span className="font-display text-3xl font-black text-emerald-400 mt-1">
                  ${pagoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-text-secondary">MXN</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Tarifa base</span>
                <span className="font-medium">${(pagoTotal * 0.9).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Incentivo</span>
                <span className="font-medium">${(pagoTotal * 0.1).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-1" />

            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Método de pago</span>
                <span className="font-medium text-sm mt-1">Transferencia</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Estado</span>
                <div className="mt-1 inline-flex bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-amber-500 text-[10px] font-bold">
                  PENDIENTE
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "info" && (
          <div className="bg-[#0E1524] rounded-3xl border border-border/15 p-5 shadow-lg relative flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">ID de traslado</span>
              <span className="font-display text-lg font-black mt-0.5">{folio}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 mt-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Solicitado por</span>
                <span className="font-medium text-sm mt-0.5">Ruum Ruum</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Fecha</span>
                <span className="font-medium text-sm mt-0.5 capitalize">{fecha}</span>
              </div>
              <div className="flex flex-col col-span-2">
                <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Tipo de servicio</span>
                <span className="font-medium text-sm mt-0.5">Traslado de vehículo</span>
              </div>
            </div>

            <div className="h-px w-full bg-border/20 my-2" />
            
            <div className="flex flex-col">
              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-widest">Observaciones</span>
              <span className="font-medium text-sm text-text-secondary mt-1.5 leading-relaxed">
                Revisar documentación en guantera antes de iniciar traslado.
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
