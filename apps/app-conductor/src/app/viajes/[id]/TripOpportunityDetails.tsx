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

  // Helper to check stepper milestone status based on traslado state
  const getPasoStatus = (pasoIndex: number) => {
    // pasoIndex: 1 = En camino, 2 = En origen, 3 = Traslado iniciado, 4 = En destino, 5 = Finalizado
    const mapping: Record<string, number> = {
      "pendiente_de_conductor": 0,
      "conductor_asignado": 1,
      "conductor_en_camino_al_origen": 1,
      "conductor_en_punto_de_recoleccion": 2,
      "verificacion_vehiculo_en_proceso": 2,
      "evidencia_inicial_en_proceso": 2,
      "evidencia_inicial_completada": 2,
      "vehiculo_recibido": 2,
      "traslado_en_curso": 3,
      "llegada_a_destino": 4,
      "evidencia_final_en_proceso": 4,
      "evidencia_final_completada": 4,
      "entrega_confirmada": 5,
      "servicio_cerrado": 5,
    };
    
    const currentMilestone = mapping[estado] ?? 0;
    
    if (pasoIndex < currentMilestone) return "completed";
    if (pasoIndex === currentMilestone) return "active";
    return "locked";
  };

  const renderStepperNode = (pasoIndex: number, titulo: string, descripcion: string, iconType: "car" | "pin" | "key" | "flag" | "check") => {
    const status = getPasoStatus(pasoIndex);
    
    let circleColor = "";
    let textColor = "";
    let descColor = "";
    let iconElement = null;
    
    if (status === "completed") {
      circleColor = "bg-[#10B981] border-[#10B981] text-slate-950 shadow-md";
      textColor = "text-text-primary font-bold";
      descColor = "text-text-secondary";
      iconElement = (
        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    } else if (status === "active") {
      circleColor = "bg-emerald-500/10 border-[#10B981] text-[#10B981] shadow-emerald-950/20 shadow-md ring-2 ring-emerald-500/25";
      textColor = "text-[#10B981] font-extrabold";
      descColor = "text-text-secondary";
      
      if (iconType === "car") {
        iconElement = (
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="2" y="10" width="20" height="8" rx="2" />
            <path d="M6 10 L8 5 L16 5 L18 10" />
          </svg>
        );
      } else {
        iconElement = (
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
        );
      }
    } else {
      circleColor = "bg-slate-900 border-border/15 text-text-tertiary";
      textColor = "text-text-tertiary font-bold";
      descColor = "text-text-tertiary/70";
      iconElement = (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    }
    
    return (
      <div className="flex gap-4 items-start relative select-none">
        {pasoIndex < 5 && (
          <div 
            className={`absolute left-4.5 top-9 w-[2px] h-[calc(100%-8px)] ${
              status === "completed" 
                ? "bg-[#10B981]" 
                : "border-l-2 border-dashed border-border/20"
            }`}
          />
        )}
        
        <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 z-10 transition-colors duration-300 ${circleColor}`}>
          {iconElement}
        </div>
        
        <div className="flex flex-col text-left justify-center py-0.5">
          <span className={`text-xs ${textColor} leading-tight`}>{titulo}</span>
          <span className={`text-[10px] ${descColor} mt-0.5 leading-snug`}>{descripcion}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-md md:max-w-6xl px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] text-text-primary">
      
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
        {esOferta ? (
          /* SINGLE-COLUMN OFFER VIEW */
          <div className="mx-auto w-full max-w-md flex flex-col gap-6">
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
                          <polyline points="2 12 17 22 12" />
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
          </div>
        ) : (
          /* RESPONSIVE GRID SPLIT-SCREEN ACCEPTED VIEW (ESTOY EN CAMINO) */
          <div className="grid grid-cols-1 md:grid-cols-[2.2fr_1fr] gap-8 w-full items-start">
             
             {/* Left Column (Details and Route) */}
             <div className="flex flex-col gap-6 w-full">
                
                {/* Header (Volver, Detalle del traslado, ID, Ayuda) */}
                <header className="grid grid-cols-[auto_1fr_auto] items-center pb-4 border-b border-border/10 select-none">
                  <Link
                    href={volver}
                    className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors text-xs font-bold font-display"
                    aria-label="Volver"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Volver
                  </Link>
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="font-display text-sm font-bold text-text-primary">Detalle del traslado</span>
                    <span className="font-mono text-[10px] text-text-tertiary mt-0.5 tracking-wider">ID {folio}</span>
                  </div>
                  <Link
                    href={`/cuenta/soporte?traslado=${trasladoId}`}
                    className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors text-xs font-bold font-display"
                    aria-label="Ayuda soporte"
                  >
                    <svg className="w-4 h-4 text-text-secondary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                    </svg>
                    Ayuda
                  </Link>
                </header>

                {/* Traslado Aceptado status card */}
                <section className="bg-[#0E1524] border border-emerald-500/20 rounded-2xl p-5 flex justify-between items-center text-left shadow-xs">
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#10B981] tracking-widest uppercase">
                      <span>Traslado Aceptado</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    </div>
                    <span className="text-text-tertiary text-[10px] font-bold uppercase tracking-wider mt-3">
                      Siguiente paso
                    </span>
                    <h2 className="font-display text-base font-black text-white leading-none mt-1 select-none">
                      {estado === "conductor_asignado" ? "ESTOY EN CAMINO AL ORIGEN" : "DIRÍGETE AL ORIGEN"}
                    </h2>
                    <p className="font-body text-xs text-text-secondary mt-1.5 leading-tight">
                      {estado === "conductor_asignado" 
                        ? "Dirígete al punto de recolección indicado." 
                        : "Llega al punto de origen para recolectar el vehículo."}
                    </p>
                  </div>

                  {/* Route Car SVG Illustration */}
                  <div className="hidden sm:flex items-center justify-center shrink-0 w-24 h-16 select-none opacity-80" aria-hidden="true">
                    <svg className="w-full h-full text-emerald-400" viewBox="0 0 100 50" fill="none">
                      <path d="M10 25 C 30 10, 70 40, 90 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
                      <circle cx="10" cy="25" r="4" fill="currentColor" />
                      <path d="M90 17 L93 25 L87 25 Z" fill="#EF4444" />
                      <circle cx="90" cy="25" r="3" fill="#EF4444" />
                      <g transform="translate(42, 17) rotate(15)">
                        <rect x="2" y="4" width="12" height="6" rx="1.5" fill="currentColor" />
                        <circle cx="5" cy="11" r="1.5" fill="#070B14" />
                        <circle cx="11" cy="11" r="1.5" fill="#070B14" />
                      </g>
                    </svg>
                  </div>
                </section>

                {/* Route Card & Stats Row */}
                <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-5 flex flex-col gap-4 text-left shadow-xs">
                  <div className="flex items-center justify-between gap-4 py-1">
                    <div className="flex flex-col">
                      <span className="font-display text-[9px] font-bold text-[#10B981] tracking-widest uppercase">Origen</span>
                      <span className="font-display text-base font-black text-white leading-tight mt-0.5">{origen}</span>
                      <span className="font-body text-[10px] text-text-tertiary mt-0.5">Estado de México</span>
                    </div>
                    
                    <div className="flex items-center justify-center shrink-0 text-text-secondary select-none" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>

                    <div className="flex flex-col text-right">
                      <span className="font-display text-[9px] font-bold text-[#00B4D8] tracking-widest uppercase">Destino</span>
                      <span className="font-display text-base font-black text-white leading-tight mt-0.5">{destino}</span>
                      <span className="font-body text-[10px] text-text-tertiary mt-0.5">Chiapas</span>
                    </div>
                  </div>

                  <div className="border-t border-border/10" />

                  {/* 4 Stats columns */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/5 rounded-xl p-2.5 shadow-2xs">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="font-display text-xs font-black text-white mt-1.5">{horaTexto}</span>
                      <span className="font-body text-[8px] font-bold text-text-tertiary mt-0.5 leading-none">Hora de salida</span>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/5 rounded-xl p-2.5 shadow-2xs">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 15 15" />
                      </svg>
                      <span className="font-display text-xs font-black text-white mt-1.5">{formatDuracion(duracion)}</span>
                      <span className="font-body text-[8px] font-bold text-text-tertiary mt-0.5 leading-none">Duración estimada</span>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/5 rounded-xl p-2.5 shadow-2xs">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0" aria-hidden="true">
                        <path d="M3 22 L9 2 L15 2 L21 22" />
                        <path d="M12 2 L12 22" strokeDasharray="2 2" />
                        <path d="M6 14 L18 14" />
                      </svg>
                      <span className="font-display text-xs font-black text-white mt-1.5 text-center">
                        {distancia != null ? `${distancia.toFixed(1)} km` : "Confirmar"}
                      </span>
                      <span className="font-body text-[8px] font-bold text-text-tertiary mt-0.5 leading-none">Distancia total</span>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/5 rounded-xl p-2.5 shadow-2xs">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#00B4D8] shrink-0" aria-hidden="true">
                        <rect x="2" y="10" width="20" height="8" rx="2" />
                        <path d="M6 10 L8 5 L16 5 L18 10" />
                        <circle cx="6" cy="18" r="1.5" />
                        <circle cx="18" cy="18" r="1.5" />
                      </svg>
                      <span className="font-display text-xs font-black text-white mt-1.5">01 / 01</span>
                      <span className="font-body text-[8px] font-bold text-text-tertiary mt-0.5 leading-none">Vehículos</span>
                    </div>
                  </div>
                </section>

                {/* Map Preview & Nav Actions */}
                <section className="relative rounded-2xl border border-border/25 overflow-hidden shadow-xs">
                  <div className="relative h-44 w-full select-none">
                    {origenLat && destinoLat && origenLng && destinoLng ? (
                      <>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLng}&destination=${destinoLat},${destinoLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 w-full h-full z-10"
                          aria-label="Ver mapa en Google Maps"
                        >
                          <MapaRutaConduccion
                            origen={{ lat: origenLat, lng: origenLng }}
                            destino={{ lat: destinoLat, lng: destinoLng }}
                          />
                        </a>
                        
                        {/* Ver mapa completo button */}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLng}&destination=${destinoLat},${destinoLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-3 right-3 bg-black/70 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white hover:bg-black/90 transition-colors z-20 flex items-center gap-1 select-none shadow-md"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                          Ver mapa completo
                        </a>
                      </>
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-surface-elevated/45 flex items-center justify-center text-text-tertiary">
                        Cargando mapa...
                      </div>
                    )}
                  </div>
                </section>

                {/* Waze / Apple Maps Navigation Buttons */}
                <div className="grid grid-cols-2 gap-3 select-none">
                  <a
                    href={`https://www.waze.com/ul?ll=${destinoLat},${destinoLng}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0E1524] border border-border/15 text-text-primary hover:text-[#00B4D8] font-display text-xs font-bold py-3 transition-colors shadow-xs"
                    aria-label="Abrir en Waze"
                  >
                    <span className="text-base">💬</span>
                    Abrir en Waze
                  </a>
                  <a
                    href={`https://maps.apple.com/?saddr=&dirflg=w&z=15&lat=${destinoLat}&lon=${destinoLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#0E1524] border border-border/15 text-text-primary hover:text-[#00B4D8] font-display text-xs font-bold py-3 transition-colors shadow-xs"
                    aria-label="Abrir en Apple Maps"
                  >
                    <span className="text-base">🗺️</span>
                    Abrir en Apple Maps
                  </a>
                </div>

                {/* Itinerario Section */}
                <section className="flex flex-col gap-4 text-left">
                  <div className="flex items-center gap-2 text-[#00B4D8]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span className="font-display text-[10px] font-extrabold tracking-widest uppercase">
                      Itinerario
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
                        <h3 className="font-display text-sm font-bold text-text-primary leading-tight flex items-center gap-2">
                          {origen} 
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-extrabold px-1.5 py-0.5 rounded-md text-[8px] tracking-wider uppercase select-none">
                            Origen
                          </span>
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
                              <polyline points="2 12 17 22 12" />
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

                    {/* Punto 2: Destino */}
                    <div className="relative flex flex-col gap-3 mt-6">
                      <div className="absolute -left-[54px] top-0 w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center font-display text-sm font-black shadow-md select-none border-2 border-[#070B14]">
                        2
                      </div>

                      <div className="flex flex-col">
                        <h3 className="font-display text-sm font-bold text-text-primary leading-tight flex items-center gap-2">
                          {destino}
                          <span className="bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 font-extrabold px-1.5 py-0.5 rounded-md text-[8px] tracking-wider uppercase select-none">
                            Destino
                          </span>
                        </h3>
                        <span className="font-body text-[11px] text-text-tertiary mt-1">
                          {pasaporte.destino_direccion || "Av. de los Serranos 220, El Magueyito, 29000, Chiapas"}
                        </span>
                      </div>
                    </div>

                  </div>
                </section>

                {/* Transfer Notes Card */}
                <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-5 flex flex-col gap-2.5 text-left shadow-xs">
                  <div className="flex items-center gap-2 text-purple-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

             </div>

             {/* Right Column / Sidebar (Progreso, Información, Contactar) */}
             <div className="flex flex-col gap-6 w-full md:sticky md:top-6">
                
                {/* Stepper Card */}
                <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-5 flex flex-col gap-4 text-left shadow-xs">
                  <span className="font-display text-[10px] font-extrabold text-text-tertiary tracking-widest uppercase">
                    Progreso del traslado
                  </span>
                  <div className="flex flex-col gap-5 mt-2 pl-0.5">
                    {renderStepperNode(1, "En camino al origen", "Dirígete al punto de recolección.", "car")}
                    {renderStepperNode(2, "En origen", "Llegada al punto de recolección.", "pin")}
                    {renderStepperNode(3, "Traslado iniciado", "Comienza el traslado hacia el destino.", "key")}
                    {renderStepperNode(4, "En destino", "Llegada al punto de destino.", "flag")}
                    {renderStepperNode(5, "Traslado finalizado", "Completa el traslado y recibe instrucciones.", "check")}
                  </div>
                </section>

                {/* Información del traslado Card */}
                <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-5 flex flex-col gap-4.5 text-left shadow-xs">
                  <span className="font-display text-[10px] font-extrabold text-text-tertiary tracking-widest uppercase">
                    Información del traslado
                  </span>
                  
                  <div className="flex flex-col gap-1 select-none">
                    <span className="font-display text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Folio</span>
                    <span className="font-mono text-xs font-semibold text-text-primary tracking-wider uppercase">{folio}</span>
                  </div>

                  <div className="border-t border-border/10" />

                  <div className="flex flex-col gap-1.5">
                    <span className="font-display text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Pago del traslado</span>
                    <div className="font-display text-2xl font-black text-[#10B981] leading-none">
                      ${pagoTotal != null ? pagoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      <span className="text-[11px] font-bold text-text-secondary ml-1">MXN</span>
                    </div>
                    <p className="font-body text-[9px] text-text-secondary mt-0.5 leading-snug">
                      Total que recibirás por completar este traslado.
                    </p>
                  </div>

                  <div className="border-t border-border/10" />

                  <div className="flex flex-col gap-1 select-none">
                    <span className="font-display text-[9px] font-bold text-text-tertiary uppercase tracking-wider">Solicitante</span>
                    <span className="font-display text-xs font-bold text-text-primary">{pasaporte.origen_ciudad || "Ciudad de México"}</span>
                  </div>
                </section>

                {/* Contactar usuario Card */}
                <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-5 flex flex-col gap-4 text-left shadow-xs">
                  <span className="font-display text-[10px] font-extrabold text-text-tertiary tracking-widest uppercase">
                    Contactar usuario
                  </span>
                  <div className="grid grid-cols-2 gap-3 mt-2 select-none">
                    <a
                      href={`tel:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-transparent border border-border/60 hover:border-text-primary text-text-secondary hover:text-text-primary font-display text-xs font-bold py-2.5 transition-colors cursor-pointer select-none"
                      aria-label="Llamar al usuario"
                    >
                      <span>📞</span>
                      Llamar
                    </a>
                    <a
                      href={`sms:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-transparent border border-border/60 hover:border-text-primary text-text-secondary hover:text-text-primary font-display text-xs font-bold py-2.5 transition-colors cursor-pointer select-none"
                      aria-label="Enviar mensaje de texto"
                    >
                      <span>💬</span>
                      Enviar mensaje
                    </a>
                  </div>
                </section>

             </div>

          </div>
        )}
      </div>

      {error && esOferta && (
        <div className="mt-3">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}
      {avisoExito && esOferta && (
        <div className="mt-3">
          <Aviso tono="info">{avisoExito}</Aviso>
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
          /* When not an offer (already accepted), render assigned action buttons matching current active state */
          <div className="flex flex-col gap-3 w-full">
            
            {error && (
              <div className="my-1">
                <Aviso tono="danger">{error}</Aviso>
              </div>
            )}
            {avisoExito && (
              <div className="my-1">
                <Aviso tono="info">{avisoExito}</Aviso>
              </div>
            )}

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
              <div className="flex flex-col gap-3 w-full">
                
                {/* Primary Action Button (Estoy en camino / Llegué) */}
                {estado === "conductor_asignado" ? (
                  <button
                    type="button"
                    onClick={handleEstoyEnCamino}
                    disabled={procesando}
                    className="w-full min-h-12 rounded-2xl bg-[#10B981] hover:bg-[#0EA271] text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden"
                  >
                    <svg className="w-4 h-4 text-white shrink-0 rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {procesando ? TEXTOS_CARGANDO.actualizando : "ESTOY EN CAMINO AL ORIGEN"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleLlegue}
                    disabled={procesando}
                    className="w-full min-h-12 rounded-2xl bg-[#10B981] hover:bg-[#0EA271] text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden"
                  >
                    <svg className="w-4.5 h-4.5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {procesando ? TEXTOS_CARGANDO.actualizando : "¡LLEGUE!"}
                  </button>
                )}
                {/* Important safety warning disclaimer */}
                <div className="flex items-start gap-2.5 px-1 py-1.5 select-none">
                  <svg className="w-4.5 h-4.5 text-[#10B981] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 11 11 13 15 9" />
                  </svg>
                  <p className="font-body text-[10px] text-text-secondary leading-snug text-left">
                    <span className="font-bold text-[#10B981] mr-1">Importante</span>
                    Al continuar, asegúrate de conducir de forma segura y cumplir con todas las indicaciones del solicitante.
                  </p>
                </div>

              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Accept/Reject */}
      {confirmarAccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm bg-[#090D1A] border border-border/40 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-slideUp">
            <h3 className="font-display text-base font-black text-text-primary uppercase tracking-wider flex items-center gap-2">
              {confirmarAccion === "aceptar" ? "⚠️ ¿Aceptar Oferta?" : esOferta ? "⚠️ ¿Rechazar Oferta?" : "⚠️ ¿Rechazar Traslado?"}
            </h3>
            <p className="font-body text-xs text-text-secondary leading-relaxed">
              {confirmarAccion === "aceptar"
                ? "¿Estás seguro de que deseas aceptar esta oferta de traslado? Esta acción te asignará el viaje de inmediato."
                : esOferta
                ? "¿Estás seguro de que deseas rechazar esta oferta de traslado? No podrás volver a ver esta oportunidad en tu panel."
                : "¿Estás seguro de que deseas rechazar este traslado? Esta acción te desasignará del viaje."
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
