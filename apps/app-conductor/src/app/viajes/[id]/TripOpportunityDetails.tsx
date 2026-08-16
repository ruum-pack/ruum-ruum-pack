"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { aceptarViaje, avanzarEstadoTraslado } from "@ruum/api/services";
import { type PuntoMapa } from "../../../lib/mapbox-rutas";
import { MapaRutaConduccion } from "./MapaRutaConduccion";

type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export function TripOpportunityDetails({
  pasaporte,
  volver
}: {
  pasaporte: PasaporteRow;
  volver: string;
}) {
  const router = useRouter();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avisoExito, setAvisoExito] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmarAccion, setConfirmarAccion] = useState<"aceptar" | "rechazar" | null>(null);

  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();
  const estado = pasaporte.estado as Database["public"]["Enums"]["estado_traslado"];
  const esOferta = estado === "pendiente_de_conductor" || !pasaporte.conductor_id;

  const origen = pasaporte.origen_ciudad || "Por confirmar";
  const destino = pasaporte.destino_ciudad || "Por confirmar";
  const distancia = pasaporte.distancia_km;
  const duracion = pasaporte.tiempo_estimado_horas;
  const origenLat = pasaporte.origen_lat ?? 19.4326;
  const origenLng = pasaporte.origen_lng ?? -99.1332;
  const destinoLat = pasaporte.destino_lat ?? 19.4326;
  const destinoLng = pasaporte.destino_lng ?? -99.1332;
  const fechaReferencia = pasaporte.creado_en ?? pasaporte.actualizado_en ?? new Date().toISOString();
  const horaTexto = new Intl.DateTimeFormat("es-MX", { 
    hour: "2-digit", 
    minute: "2-digit", 
    hour12: false, 
    timeZone: "America/Mexico_City" 
  }).format(new Date(fechaReferencia));

  // Duration formatter helper
  const formatDuracion = (horasDouble: number | null) => {
    if (horasDouble == null) return "Por confirmar";
    const totalMinutos = Math.round(horasDouble * 60);
    const hrs = Math.floor(totalMinutos / 60);
    const mins = totalMinutos % 60;
    return mins > 0 ? `${hrs} h ${mins} min` : `${hrs} h`;
  };

  // Earning
  const pagoTotal = pasaporte.ganancia_conductor;

  // Navigation target
  const navigationTargetLat = pasaporte.origen_lat ?? 19.4326;
  const navigationTargetLng = pasaporte.origen_lng ?? -99.1332;
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${navigationTargetLat},${navigationTargetLng}`;

  async function handleAceptar() {
    setProcesando(true);
    setError(null);
    setAvisoExito(null);

    try {
      const cliente = crearClienteNavegador();
      
      const { data: { session } } = await cliente.auth.getSession();
      if (!session?.user) {
        throw new Error("Inicia sesión para poder aceptar traslados.");
      }
      
      // Query conductor profile to get the correct conductor.id
      const { data: conductorData, error: condError } = await cliente
        .from("conductores")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (condError || !conductorData) {
        throw new Error("No se encontró tu perfil de conductor en el sistema.");
      }

      await aceptarViaje(cliente, trasladoId, conductorData.id);
      setAvisoExito("¡Traslado aceptado! Agregado a tus traslados asignados.");
      setTimeout(() => {
        router.push("/viajes?vista=mis-viajes");
      }, 1500);
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos aceptar el traslado."));
    } finally {
      setProcesando(false);
    }
  }

  function handleRechazar() {
    router.push("/viajes?vista=disponibles");
  }

  async function handleEstoyEnCamino() {
    setProcesando(true);
    setError(null);
    setAvisoExito(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual = (pasaporte.estado || "conductor_asignado") as Database["public"]["Enums"]["estado_traslado"];
      await avanzarEstadoTraslado(cliente, trasladoId, estadoActual);
      setAvisoExito("¡Buen viaje! Has iniciado tu camino al origen.");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar el traslado."));
    } finally {
      setProcesando(false);
    }
  }

  async function handleLlegue() {
    setProcesando(true);
    setError(null);
    setAvisoExito(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual = (pasaporte.estado || "conductor_en_camino_al_origen") as Database["public"]["Enums"]["estado_traslado"];
      
      if (estadoActual === "conductor_asignado") {
        await avanzarEstadoTraslado(cliente, trasladoId, "conductor_asignado");
        // Wait 300ms for Supabase transaction to commit and avoid race conditions
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_camino_al_origen");
      } else {
        await avanzarEstadoTraslado(cliente, trasladoId, estadoActual);
      }
      
      setAvisoExito("¡Has llegado al punto de recolección!");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada."));
    } finally {
      setProcesando(false);
    }
  }

  async function handleIniciarViaje() {
    setProcesando(true);
    setError(null);
    setAvisoExito(null);
    try {
      const cliente = crearClienteNavegador();
      const estadoActual = (pasaporte.estado || "evidencia_inicial_completada") as Database["public"]["Enums"]["estado_traslado"];
      
      if (estadoActual === "evidencia_inicial_completada") {
        await avanzarEstadoTraslado(cliente, trasladoId, "evidencia_inicial_completada");
        // Wait 300ms for Supabase transaction to commit and avoid race conditions
        await new Promise((resolve) => setTimeout(resolve, 300));
        await avanzarEstadoTraslado(cliente, trasladoId, "vehiculo_recibido");
      } else if (estadoActual === "vehiculo_recibido") {
        await avanzarEstadoTraslado(cliente, trasladoId, "vehiculo_recibido");
      }
      
      setAvisoExito("¡Traslado en curso iniciado!");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos iniciar el traslado."));
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

      <div className="w-full flex flex-col flex-1 animate-fade-in pb-20">
        
         {/* Header */}
         <header className="grid grid-cols-[auto_1fr_auto] items-center pb-4 border-b border-border/10 select-none">
           <Link
             href={volver}
             className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0"
             aria-label="Volver"
           >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
               <polyline points="15 18 9 12 15 6" />
             </svg>
           </Link>
           <div className="flex flex-col items-center justify-center text-center">
             <span className="font-display text-sm font-bold text-text-primary">Detalle del traslado</span>
             <span className="font-mono text-[10px] text-text-tertiary mt-0.5 tracking-wider">ID {folio}</span>
           </div>
           <button
             type="button"
             className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0"
             aria-label="Compartir traslado"
             onClick={() => {
               if (navigator.share) {
                 navigator.share({
                   title: `Traslado Ruum - ${folio}`,
                   text: `Detalles del traslado ${origen} a ${destino}`,
                   url: window.location.href,
                 }).catch(() => {});
               }
             }}
           >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
               <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
               <polyline points="16 6 12 2 8 6" />
               <line x1="12" y1="2" x2="12" y2="15" />
             </svg>
           </button>
         </header>

         {/* Route Details */}
         <div className="mt-6 flex flex-col text-left pl-1">
           <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#a8e820] tracking-widest uppercase">
             <span>Traslado Disponible</span>
             <span className="h-1.5 w-1.5 rounded-full bg-[#a8e820] animate-pulse" />
           </div>
           
           <div className="mt-4 flex flex-col gap-3 relative">
             <h2 className="font-display text-2xl font-black text-text-primary leading-none">
               {origen}
             </h2>
             
             {/* Vertical dotted line with arrow */}
             <div className="flex flex-col items-center justify-center w-6 h-8 -my-1">
               <div className="w-[1px] border-l-2 border-dotted border-border/40 h-5" />
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                 <polyline points="6 9 12 15 18 9" />
               </svg>
             </div>

             <h2 className="font-display text-2xl font-black text-text-primary leading-none">
               {destino}
             </h2>
           </div>
         </div>

        {/* Essential Info Row */}
        <div className="grid grid-cols-3 gap-3 mt-6 select-none">
          <div className="flex items-center gap-2.5 bg-[#0E1524] border border-border/10 rounded-xl p-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-display text-xs font-black text-text-primary">{horaTexto}</span>
              <span className="font-body text-[9px] font-bold text-text-secondary mt-0.5">Salida</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-[#0E1524] border border-border/10 rounded-xl p-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 15 15" />
            </svg>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-display text-xs font-black text-text-primary">{formatDuracion(duracion)}</span>
              <span className="font-body text-[9px] font-bold text-text-secondary mt-0.5">Duración</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-[#0E1524] border border-border/10 rounded-xl p-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div className="flex flex-col text-left leading-tight">
              <span className="font-display text-xs font-black text-text-primary">
                {distancia != null ? `${distancia.toFixed(1)} km` : "Confirmar"}
              </span>
              <span className="font-body text-[9px] font-bold text-text-secondary mt-0.5">Distancia</span>
            </div>
          </div>
        </div>

        {/* Interactive Route Map Preview */}
        <div className="mt-6 relative bg-surface-elevated/20 border border-border/30 rounded-2xl overflow-hidden shadow-xs">
          <div className="relative h-44 w-full select-none">
            {origenLat && destinoLat && origenLng && destinoLng ? (
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLng}&destination=${destinoLat},${destinoLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 w-full h-full"
                aria-label="Ver mapa en Google Maps"
              >
                <MapaRutaConduccion
                  origen={{ lat: origenLat, lng: origenLng }}
                  destino={{ lat: destinoLat, lng: destinoLng }}
                />
              </a>
            ) : (
              <div className="absolute inset-0 w-full h-full bg-surface-elevated/45 flex items-center justify-center text-text-tertiary">
                Cargando mapa...
              </div>
            )}
          </div>
        </div>

        {/* Waze / Apple Maps Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3 select-none">
          <a
            href={`https://www.waze.com/ul?ll=${destinoLat},${destinoLng}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0E1524] border border-border/15 text-text-primary hover:text-[#00B4D8] font-display text-xs font-bold py-3 transition-colors shadow-xs"
            aria-label="Abrir en Waze"
          >
            <span className="text-base">💬</span>
            Waze
          </a>
          <a
            href={`https://maps.apple.com/?saddr=&dirflg=w&z=15&lat=${destinoLat}&lon=${destinoLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#0E1524] border border-border/15 text-text-primary hover:text-[#00B4D8] font-display text-xs font-bold py-3 transition-colors shadow-xs"
            aria-label="Abrir en Apple Maps"
          >
            <span className="text-base">🗺️</span>
            Apple Maps
          </a>
        </div>

        {error && (
          <div className="mt-3">
            <Aviso tono="danger">{error}</Aviso>
          </div>
        )}
        {avisoExito && (
          <div className="mt-3">
            <Aviso tono="info">{avisoExito}</Aviso>
          </div>
        )}

        {/* Payment Details Card */}
        <section className="mt-6 bg-[#2B2317] border border-[#523F27]/60 rounded-2xl p-5 flex justify-between items-center text-left shadow-xs">
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[10px] font-extrabold text-[#DCA24C] tracking-widest uppercase">
              Pago del traslado
            </span>
            <div className="font-display text-2xl font-black text-white">
              ${pagoTotal != null ? pagoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              <span className="text-[11px] font-bold text-text-secondary ml-1">MXN</span>
            </div>
            <p className="font-body text-[10px] text-text-tertiary leading-none">
              Total que recibirás por completar este traslado
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-[#DCA24C]/10 border border-[#DCA24C]/35 flex items-center justify-center text-[#DCA24C] shrink-0 shadow-xs">
            <span className="font-display text-xl font-bold">$</span>
          </div>
        </section>

        {/* Transfer Notes Card */}
        <section className="mt-4 bg-[#0E1524] border border-border/15 rounded-2xl p-5 flex flex-col gap-2.5 text-left shadow-xs">
          <div className="flex items-center gap-2 text-purple-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="font-display text-[10px] font-extrabold tracking-widest uppercase">
              Instrucciones del origen
            </span>
          </div>
          <p className="font-body text-xs leading-relaxed text-text-secondary whitespace-pre-wrap pl-0.5">
            {pasaporte.origen_referencias || "Sin notas ni especificaciones adicionales del solicitante para el punto de origen."}
          </p>
        </section>

        {/* Itinerario Section */}
        <section className="mt-6 flex flex-col gap-4 text-left">
          <div className="flex items-center gap-2 text-[#00B4D8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span className="font-display text-[10px] font-extrabold tracking-widest uppercase">
              Itinerario de ruta
            </span>
          </div>

          <div className="flex flex-col relative pl-9 border-l-2 border-dashed border-[#00B4D8]/20 ml-4.5 pb-2">
            
            {/* Punto 1: Origen */}
            <div className="relative flex flex-col gap-3">
              {/* Number Circle Marker */}
              <div className="absolute -left-[54px] top-0 w-9 h-9 rounded-full bg-[#00B4D8] text-slate-950 flex items-center justify-center font-display text-sm font-black shadow-md select-none border-2 border-[#070B14]">
                1
              </div>

              <div className="flex flex-col">
                <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                  {origen} <span className="text-xs text-text-secondary font-normal">(Origen)</span>
                </h3>
                <span className="font-body text-[11px] text-text-tertiary mt-1">
                  {pasaporte.origen_direccion || "LOS SAUCES 274, Col. Uruapan, 52104 México"}
                </span>
              </div>

              {/* Table details Card */}
              <div className="mt-1 rounded-xl border border-border/15 bg-surface-elevated/20 p-4 flex flex-col gap-3 text-xs font-body text-text-secondary">
                <div className="flex justify-between items-center">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    Categoría de vehículo
                  </span>
                  <span className="text-text-primary font-bold capitalize">
                    {(pasaporte as any).vehiculo_tipo || "Luxury"}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-t border-border/10 pt-3">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="1" y="3" width="15" height="13" rx="2" />
                      <path d="M16 8h4l3 3v5h-7V8Z" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    Unidad
                  </span>
                  <span className="text-text-primary font-bold text-right truncate max-w-[160px]">
                    {pasaporte.vehiculo_marca || "BMW"} {pasaporte.vehiculo_modelo || "Serie 1"} ({pasaporte.vehiculo_anio || "2020"})
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-border/10 pt-3">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a7 7 0 0 0-7 7c0 4.17 7 13 7 13s7-8.83 7-7a7 7 0 0 0-7-7z" />
                    </svg>
                    Color
                  </span>
                  <span className="text-text-primary font-bold capitalize">
                    {pasaporte.vehiculo_color || "Rojo"}
                  </span>
                </div>

                <div className="flex justify-between items-center border-t border-border/10 pt-3">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Recolección vehículo
                  </span>
                  <span className="bg-[#EAB308]/15 text-[#EAB308] border border-[#EAB308]/30 font-extrabold px-2 py-0.5 rounded-md text-[9px] tracking-wide flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#EAB308] animate-ping" />
                    DETALLES POR CONFIRMAR
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ¡Llegue! Button for assigned state */}
        {!esOferta && (estado === "conductor_asignado" || estado === "conductor_en_camino_al_origen") && (
          <div className="mt-6 mb-8 w-full">
            <button
              type="button"
              onClick={handleLlegue}
              disabled={procesando}
              className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5"
            >
              <span>✓</span> ¡LLEGUE!
            </button>
          </div>
        )}

        {/* Sticky footer for action buttons */}
        <div className="sticky bottom-0 inset-x-0 z-20 bg-[#090D1A]/95 backdrop-blur-md border-t border-border/15 py-4 px-4 -mx-4 sm:-mx-6 mt-8 flex flex-col gap-3 select-none">
          {esOferta ? (
            <>
              <div className="flex gap-3 w-full">
                {/* ACEPTAR OFERTA Button */}
                <button
                  type="button"
                  onClick={() => setConfirmarAccion("aceptar")}
                  disabled={procesando}
                  className="flex-[2] min-h-12 rounded-2xl bg-[#10B981] hover:bg-[#0EA271] text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden"
                >
                  <svg className="w-4 h-4 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {procesando ? TEXTOS_CARGANDO.actualizando : "ACEPTAR OFERTA"}
                </button>
                
                {/* RECHAZAR OFERTA Button */}
                <button
                  type="button"
                  onClick={() => setConfirmarAccion("rechazar")}
                  className="flex-1 min-h-12 rounded-2xl bg-transparent border border-red-500/50 hover:border-red-500 hover:bg-red-500/10 text-red-500 font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-xs select-none flex items-center justify-center gap-1.5 focus:outline-hidden"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  RECHAZAR
                </button>
              </div>

              {/* Commitment Shield */}
              <div className="flex items-start gap-2.5 px-1 py-1.5">
                <svg className="w-4.5 h-4.5 text-[#10B981] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 11 11 13 15 9" />
                </svg>
                <p className="font-body text-[10px] text-text-secondary leading-snug text-left">
                  Al aceptar el traslado, te comprometes a realizarlo bajo las condiciones mostradas.
                </p>
              </div>
            </>
          ) : (
            /* When not an offer (already accepted), render original assigned action buttons */
            <div className="flex flex-col gap-3">
              {(estado === "evidencia_inicial_en_proceso" || estado === "evidencia_final_en_proceso") ? (
                <Link
                  href={`/viajes/${trasladoId}/evidencia`}
                  className="w-full min-h-12 rounded-2xl bg-[#00B4D8] text-white hover:bg-[#0092B0] font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 text-center"
                >
                  {estado === "evidencia_inicial_en_proceso" ? "CONTINUAR EVIDENCIAS" : "CONTINUAR EVIDENCIAS DE ENTREGA"}
                </Link>
              ) : (estado === "evidencia_inicial_completada" || estado === "vehiculo_recibido") ? (
                <button
                  type="button"
                  onClick={handleIniciarViaje}
                  disabled={procesando}
                  className="w-full min-h-12 rounded-2xl bg-[#10B981] text-white hover:bg-[#0EA271] font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus:outline-hidden"
                >
                  {procesando ? TEXTOS_CARGANDO.actualizando : "INICIAR TRASLADO"}
                </button>
              ) : (
                <>
                  <div className="flex gap-3">
                    <a
                      href={navigationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-12 rounded-2xl bg-transparent hover:bg-surface-elevated/40 border border-border/80 text-text-secondary hover:text-text-primary font-display text-xs font-black tracking-widest uppercase transition-all select-none text-center flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary shrink-0" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      RECOLECCIÓN
                    </a>

                    <button
                      type="button"
                      onClick={handleEstoyEnCamino}
                      disabled={procesando || (estado !== "conductor_asignado")}
                      className="flex-1 min-h-12 rounded-2xl bg-[#00B4D8] text-white hover:bg-[#0092B0] disabled:opacity-50 disabled:cursor-not-allowed font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center"
                    >
                      {procesando ? TEXTOS_CARGANDO.actualizando : "ESTOY EN CAMINO"}
                    </button>
                  </div>

                  <a
                    href={`tel:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
                    className="w-full min-h-12 rounded-2xl bg-transparent hover:bg-surface-elevated/20 border border-[#00B4D8]/45 text-[#00B4D8] font-display text-xs font-black tracking-widest uppercase transition-all select-none text-center flex items-center justify-center active:scale-98 cursor-pointer"
                  >
                    CONTACTAR USUARIO
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Accept/Reject */}
      {confirmarAccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-[#090D1A] border border-border/40 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-slideUp">
            <h3 className="font-display text-base font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
              {confirmarAccion === "aceptar" ? "⚠️ ¿Aceptar Oferta?" : "⚠️ ¿Rechazar Oferta?"}
            </h3>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              {confirmarAccion === "aceptar"
                ? "¿Estás seguro de que deseas aceptar esta oferta de traslado? Esta acción te asignará el viaje de inmediato."
                : "¿Estás seguro de que deseas rechazar esta oferta de traslado? No podrás volver a ver esta oportunidad en tu panel."
              }
            </p>
            {confirmarAccion === "aceptar" && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-1.5 text-[11px] font-body text-amber-400 leading-relaxed">
                <span className="font-bold flex items-center gap-1">
                  ⚠️ ADVERTENCIA OPERATIVA (TRASLADO INCOMPLETO):
                </span>
                <p>
                  Este traslado cuenta con detalles por confirmar en origen o destino. Al aceptar, confirmas estar de acuerdo con las siguientes directrices:
                </p>
                <ul className="list-disc pl-4 flex flex-col gap-0.5 font-medium text-text-secondary">
                  <li>Esperar las especificaciones y accesos de recolección en sitio.</li>
                  <li>Coordinar con la mesa de control de Ruum ante variaciones de ruta.</li>
                </ul>
              </div>
            )}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => setConfirmarAccion(null)}
                className="flex-1 min-h-11 rounded-xl bg-transparent border border-border/80 text-text-secondary hover:text-text-primary font-display text-xs font-black tracking-wider transition-colors cursor-pointer select-none"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmarAccion;
                  setConfirmarAccion(null);
                  if (action === "aceptar") {
                    handleAceptar();
                  } else {
                    handleRechazar();
                  }
                }}
                disabled={procesando}
                className={`flex-[2] min-h-11 rounded-xl text-white font-display text-xs font-black tracking-wider transition-colors cursor-pointer shadow-md select-none flex items-center justify-center ${
                  confirmarAccion === "aceptar" 
                    ? "bg-[#10B981] hover:bg-[#10B981]/90" 
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {procesando ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  confirmarAccion === "aceptar" ? "SÍ, ACEPTAR" : "SÍ, RECHAZAR"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
