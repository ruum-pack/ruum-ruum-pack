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
import { getTripPresentation } from "../../../lib/trip-presentation";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];

export function TripDetailsClient({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const trasladoId = pasaporte.traslado_id!;
  const estado = pasaporte.estado as EstadoTraslado;
  const presentation = getTripPresentation(estado);

  const folio = trasladoId.slice(0, 8).toUpperCase();
  
  // Dynamic action label
  const btnLabel = (procesando ? TEXTOS_CARGANDO.actualizando : presentation.primaryAction.label).toUpperCase();

  // Format Time
  const fechaReferencia = pasaporte.creado_en ?? pasaporte.actualizado_en ?? new Date().toISOString();
  const horaTexto = new Intl.DateTimeFormat("es-MX", { 
    hour: "2-digit", 
    minute: "2-digit", 
    hour12: false, 
    timeZone: "America/Mexico_City" 
  }).format(new Date(fechaReferencia));

  // Format Duration Helper
  const formatDuracion = (horasDouble: number | null) => {
    if (horasDouble == null) return "Por confirmar";
    const totalMinutos = Math.round(horasDouble * 60);
    const hrs = Math.floor(totalMinutos / 60);
    const mins = totalMinutos % 60;
    return mins > 0 ? `${hrs} h ${mins} min` : `${hrs} h`;
  };

  // Dynamic Details
  const duracionTexto = formatDuracion(pasaporte.tiempo_estimado_horas);
  const distanciaTexto = `${(pasaporte.distancia_km || 138.2).toFixed(1)}Km`;
  const pasajeroCount = "01";
  const autoCount = "01";

  // Notes text from solicitor (notas de origen)
  const notasTexto = pasaporte.origen_referencias || 
    "Sin notas ni especificaciones adicionales del solicitante para el punto de origen.";

  // Navigation target
  const navigationTargetLat = pasaporte.origen_lat ?? 19.4326;
  const navigationTargetLng = pasaporte.origen_lng ?? -99.1332;
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${navigationTargetLat},${navigationTargetLng}`;

  async function avanzar() {
    setProcesando(true);
    setError(null);

    try {
      const cliente = crearClienteNavegador();
      await avanzarEstadoTraslado(cliente, trasladoId, estado);
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos actualizar el estado del viaje."));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] text-text-primary">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 animate-fade-in">
        
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-border/20">
          <Link 
            href={volver} 
            className="p-1.5 text-text-primary hover:text-route-action transition-colors shrink-0"
            aria-label="Volver"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          
          <h1 className="font-display text-xl font-extrabold text-text-primary tracking-tight">
            Viaje #{folio}
          </h1>

          <Link
            href={`/cuenta/soporte?traslado=${trasladoId}`}
            className="w-8 h-8 rounded-full bg-surface-elevated border border-border/40 flex items-center justify-center text-text-secondary hover:text-text-primary font-bold text-sm select-none cursor-pointer"
            aria-label="Ayuda"
          >
            ?
          </Link>
        </header>

        {/* Detalles Section */}
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold text-text-primary">
            Detalles
          </h2>
          
          <div className="flex flex-wrap items-center gap-4 text-text-secondary font-body text-xs font-semibold">
            {/* Hora */}
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{horaTexto}</span>
            </div>

            {/* Duración */}
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2v4" />
                <path d="M12 12h4" />
              </svg>
              <span>{duracionTexto}</span>
            </div>

            {/* Distancia */}
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{distanciaTexto}</span>
            </div>

            {/* Pasajeros */}
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{pasajeroCount}</span>
            </div>

            {/* Autos */}
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              <span>{autoCount}</span>
            </div>
          </div>

          <p className="font-body text-[11px] leading-relaxed text-text-tertiary">
            El tiempo puede variar según el tráfico, el clima u otros retrasos.
          </p>
        </section>

        {error && (
          <div className="mt-3">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}

        {/* Viaje Compartido Banner */}
        <div className="mt-4 rounded-full bg-surface-elevated/60 border border-border/30 px-4 py-2 flex items-center justify-between text-text-secondary font-body text-[11px] font-bold">
          <span className="tracking-wide">VIAJE COMPARTIDO INCLUIDO.</span>
          <span className="w-4 h-4 rounded-full bg-border/40 flex items-center justify-center font-bold text-[9px] text-text-tertiary cursor-pointer select-none">
            i
          </span>
        </div>

        {/* Notas Card */}
        <section className="mt-6 flex flex-col gap-3">
          <div className="w-full bg-surface-elevated border border-border/40 rounded-2xl p-5 flex flex-col gap-2 relative">
            <span className="font-display text-[10px] font-black text-text-tertiary tracking-widest uppercase">
              NOTAS DE ORIGEN (SOLICITANTE)
            </span>
            <p className={`font-body text-xs leading-relaxed text-text-secondary transition-all ${
              notesExpanded ? "" : "line-clamp-2"
            }`}>
              {notasTexto}
            </p>
            <button
              type="button"
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="mt-2 mx-auto w-8 h-5 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-transform cursor-pointer select-none focus:outline-hidden"
              aria-label={notesExpanded ? "Contraer notas" : "Expandir notas"}
            >
              <svg 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={`transition-transform duration-300 ${notesExpanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </section>

        {/* Itinerario Section */}
        <section className="mt-6 flex flex-col gap-4 mb-8">
          <h2 className="font-display text-sm font-black text-text-tertiary tracking-widest uppercase">
            ITINERARIO
          </h2>

          <div className="flex flex-col relative pl-9 border-l-[3px] border-solid border-[#00B4D8]/45 ml-4.5 gap-8">
            
            {/* Punto 1: Origen */}
            <div className="relative flex flex-col gap-2">
              {/* Number Circle Marker */}
              <div className="absolute -left-[20px] top-0 w-9 h-9 rounded-full bg-[#00B4D8] text-slate-950 flex items-center justify-center font-display text-sm font-black shadow-md select-none border-2 border-[#090D1A]">
                1
              </div>

              <div className="flex flex-col">
                <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                  {pasaporte.origen_ciudad || "Amazon DTL1"}
                </h3>
                <span className="font-body text-[11px] text-text-tertiary mt-0.5">
                  {pasaporte.origen_direccion || "Toluca Toluca, Méx."}
                </span>
              </div>

              <div className="flex flex-col gap-2 mt-1.5 font-body text-xs text-text-secondary">
                <p className="flex items-start gap-2">
                  <span className="text-xl leading-none">📍</span>
                  <span className="mt-0.5">{pasaporte.origen_ciudad || "Toluca, Méx."}</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-xl leading-none">📄</span>
                  <span className="mt-0.5">Formulario - Amazon</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="text-xl leading-none">🚗</span>
                  <span className="mt-0.5 text-text-tertiary">Recolección Vehículo por confirmar</span>
                </p>
              </div>
            </div>

            {/* Punto 2: Destino */}
            <div className="relative flex flex-col gap-2 mt-2">
              {/* Number Circle Marker */}
              <div className="absolute -left-[20px] top-0 w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center font-display text-sm font-black shadow-md select-none border-2 border-[#090D1A]">
                2
              </div>

              <div className="flex flex-col">
                <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                  {pasaporte.destino_ciudad || "Automundo EDOMEX"}
                </h3>
                <span className="font-body text-[11px] text-text-tertiary mt-0.5">
                  {pasaporte.destino_direccion || "Ciudad de México, CDMX"}
                </span>
              </div>

              <div className="flex flex-col gap-2 mt-1.5 font-body text-xs text-text-secondary">
                <p className="flex items-start gap-2">
                  <span className="text-xl leading-none">🚗</span>
                  <span className="mt-0.5 text-text-tertiary">Entrega Vehículo por confirmar</span>
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Sticky footer for action buttons */}
        <div className="sticky bottom-0 inset-x-0 z-20 bg-[#090D1A]/95 backdrop-blur-md border-t border-border/20 py-4 px-4 -mx-4 sm:-mx-6 flex gap-3 mt-8">
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-12 rounded-xl bg-surface-elevated hover:bg-border/40 text-text-primary font-display text-xs font-black tracking-wide flex items-center justify-center border border-border/40 transition-all select-none text-center"
          >
            VER UBICACIÓN
          </a>
          <button
            type="button"
            onClick={avanzar}
            disabled={procesando}
            className="flex-1 min-h-12 rounded-xl bg-[#10B981] text-white hover:bg-[#10B981]/90 disabled:opacity-50 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {btnLabel}
          </button>
        </div>

      </div>
    </div>
  );
}
