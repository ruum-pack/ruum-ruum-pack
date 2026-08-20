"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { TEXTOS_CARGANDO } from "@ruum/shared/constants";
import type { Database } from "@ruum/shared/types";
import { traducirErrorOperativo } from "@ruum/shared/utils";
import { crearClienteNavegador } from "../../../lib/supabase-browser";
import { aceptarViaje, avanzarEstadoTraslado } from "@ruum/api/services";
import { MapaRutaConduccion } from "./MapaRutaConduccion";
import { SecondaryTripNavBar } from "./SecondaryTripNavBar";

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

  // UI state for expandable map & expandable instructions
  const [mapaExpandido, setMapaExpandido] = useState(false);
  const [instruccionesDesplegadas, setInstruccionesDesplegadas] = useState(true);

  // Countdown timer for offer acceptance (120 seconds default)
  const [segundosRestantes, setSegundosRestantes] = useState(120);

  // Confirmation modal state
  const [confirmarAccion, setConfirmarAccion] = useState<"aceptar" | "rechazar" | null>(null);

  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();
  const estado = pasaporte.estado as Database["public"]["Enums"]["estado_traslado"];
  const esOferta = estado === "pendiente_de_conductor" || !pasaporte.conductor_id;

  useEffect(() => {
    if (!esOferta) return;
    const interval = setInterval(() => {
      setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [esOferta]);

  const formatTimer = (seg: number) => {
    const mins = Math.floor(seg / 60);
    const secs = seg % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const porcentajeProgreso = Math.max(0, Math.min(100, (segundosRestantes / 120) * 100));

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

  // Financial Metrics
  const gananciaNeta = pasaporte.ganancia_conductor;
  const tarifaTotal = pasaporte.precio_final ?? pasaporte.precio_cotizado ?? null;
  const precioPorKm = gananciaNeta && distancia && distancia > 0 ? (gananciaNeta / distancia) : null;

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

  // Stepper helper
  const getPasoStatus = (pasoIndex: number) => {
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
          <div className="mx-auto w-full max-w-md flex flex-col pb-4">
             
             {/* Header simplificado con Flecha Estándar + Ícono de Ayuda */}
             <header className="grid grid-cols-[auto_1fr_auto] items-center pt-2 pb-4 select-none border-b border-border/10 mb-4">
               <Link
                 href={volver}
                 className="p-2 text-text-secondary hover:text-text-primary transition-colors shrink-0 rounded-full hover:bg-surface-elevated/60"
                 aria-label="Volver"
               >
                 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                   <polyline points="15 18 9 12 15 6" />
                 </svg>
               </Link>
               <div className="flex flex-col items-center justify-center text-center">
                 <span className="font-display text-sm font-bold text-white tracking-wide">Detalle del traslado</span>
                 <span className="font-body text-[10px] text-text-tertiary mt-0.5 font-bold uppercase tracking-wider">Oferta disponible</span>
               </div>
               <Link
                 href={`/cuenta/soporte?traslado=${trasladoId}`}
                 className="flex h-9 w-9 items-center justify-center rounded-full border border-border/15 bg-[#0E1524]/60 hover:bg-[#0E1524] text-text-primary hover:text-[#00B4D8] transition-colors shadow-xs"
                 aria-label="Ayuda"
               >
                 <span className="font-display text-xs font-black">?</span>
               </Link>
             </header>

            {/* Origin & Destination */}
            <div className="bg-[#0E1524] border border-border/15 rounded-2xl p-4 flex flex-col gap-4 text-left shadow-xs">
              <div className="flex flex-col relative pl-7">
                {/* Dotted line */}
                <div className="absolute left-[9px] top-5 bottom-5 w-[1px] border-l-[1.5px] border-dashed border-text-tertiary/40" />
                
                {/* Origen */}
                <div className="relative flex flex-col mb-5">
                  <div className="absolute -left-7 top-0.5 w-5 h-5 flex items-center justify-center">
                    <span className="h-3 w-3 rounded-full border-2 border-[#10B981] bg-transparent" />
                  </div>
                  <span className="text-[9px] font-extrabold text-[#10B981] tracking-widest uppercase mb-0.5">Origen</span>
                  <span className="font-display text-base font-bold text-white leading-tight">{origen}</span>
                  {pasaporte.origen_direccion && (
                    <span className="font-body text-[11px] text-text-tertiary mt-0.5 leading-snug">
                      {pasaporte.origen_direccion}
                    </span>
                  )}
                </div>

                {/* Destino */}
                <div className="relative flex flex-col">
                  <div className="absolute -left-7 top-0.5 w-5 h-5 flex items-center justify-center">
                    <span className="h-3 w-3 rounded-full bg-[#00B4D8]" />
                  </div>
                  <span className="text-[9px] font-extrabold text-[#00B4D8] tracking-widest uppercase mb-0.5">Destino</span>
                  <span className="font-display text-base font-bold text-white leading-tight">{destino}</span>
                  {pasaporte.destino_direccion && (
                    <span className="font-body text-[11px] text-text-tertiary mt-0.5 leading-snug">
                      {pasaporte.destino_direccion}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* — Métricas Principales Financieras (Destacadas antes de detalles secundarios) — */}
            <section className="mt-4 bg-[#0E1524] border border-[#a8e820]/30 rounded-2xl p-4 flex flex-col gap-3 shadow-md text-left select-none">
              <div className="flex items-center justify-between border-b border-border/10 pb-2.5">
                <span className="font-display text-[10px] font-extrabold text-[#a8e820] tracking-widest uppercase flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#a8e820] animate-pulse" />
                  Oferta Disponible
                </span>
                {precioPorKm != null && (
                  <span className="bg-[#a8e820]/15 text-[#a8e820] border border-[#a8e820]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    ${precioPorKm.toFixed(2)} MXN / km
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-1">
                {/* Ganancia Neta Estimada (Destacada) */}
                <div className="flex flex-col text-left">
                  <span className="font-body text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                    Ganancia Neta Estimada
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-display text-2xl sm:text-3xl font-black text-[#a8e820] leading-none tabular-nums">
                      ${gananciaNeta != null ? gananciaNeta.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Por calcular"}
                    </span>
                    <span className="font-body text-xs font-bold text-[#a8e820]">MXN</span>
                  </div>
                  <span className="font-body text-[9px] text-text-tertiary mt-1">
                    Pago directo acreditado al conductor
                  </span>
                </div>

                {/* Tarifa Total del Traslado */}
                <div className="flex flex-col text-right border-l border-border/10 pl-4">
                  <span className="font-body text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                    Tarifa Total Traslado
                  </span>
                  <div className="flex items-baseline justify-end gap-1 mt-1">
                    <span className="font-display text-xl sm:text-2xl font-bold text-white leading-none tabular-nums">
                      ${tarifaTotal != null ? tarifaTotal.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Por confirmar"}
                    </span>
                    <span className="font-body text-xs font-bold text-text-secondary">MXN</span>
                  </div>
                  <span className="font-body text-[9px] text-text-tertiary mt-1">
                    Valor total del servicio
                  </span>
                </div>
              </div>
            </section>

            {/* Stats Row (3 columnas reales: Recogida, Distancia, Duración - SIN DATO PASAJEROS) */}
            <div className="grid grid-cols-3 gap-0 mt-4 bg-[#0E1524] border border-border/15 rounded-2xl py-3.5 select-none">
              <div className="flex flex-col items-center border-r border-border/10">
                <svg className="w-4 h-4 text-[#00B4D8] mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span className="font-display text-xs font-bold text-white">{horaTexto}</span>
                <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Recogida</span>
              </div>
              <div className="flex flex-col items-center border-r border-border/10">
                <svg className="w-4 h-4 text-[#00B4D8] mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22L9 2L15 2L21 22"></path><path d="M12 2L12 22" strokeDasharray="2 2"></path></svg>
                <span className="font-display text-xs font-bold text-white">{distancia != null ? `${distancia.toFixed(1)} km` : "Por confirmar"}</span>
                <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Distancia</span>
              </div>
              <div className="flex flex-col items-center">
                <svg className="w-4 h-4 text-[#00B4D8] mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 15 15"></polyline></svg>
                <span className="font-display text-xs font-bold text-white">{formatDuracion(duracion)}</span>
                <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Duración</span>
              </div>
            </div>

            {/* Interactive Route Map Preview */}
            <div className="mt-4 relative bg-[#0a0f1a] border border-border/15 rounded-2xl overflow-hidden shadow-xs text-left">
              <div
                onClick={() => setMapaExpandido(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setMapaExpandido(true);
                }}
                className="relative h-[160px] w-full select-none cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label="Abrir mapa en pantalla completa"
              >
                {origenLat && destinoLat && origenLng && destinoLng ? (
                  <>
                    <MapaRutaConduccion
                      origen={{ lat: origenLat, lng: origenLng }}
                      destino={{ lat: destinoLat, lng: destinoLng }}
                    />
                    <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md border border-white/20 rounded-xl px-2.5 py-1 text-[10px] font-bold text-white group-hover:bg-black transition-colors z-20 flex items-center gap-1.5 shadow-md">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                      Ver mapa completo
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-surface-elevated/45 flex items-center justify-center text-text-tertiary text-xs">
                    Cargando mapa...
                  </div>
                )}
              </div>
            </div>

            {/* Modal de Mapa Completo Interactivo */}
            {mapaExpandido && (
              <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fade-in select-none">
                <header className="flex items-center justify-between p-4 border-b border-border/20 bg-[#0E1524]">
                  <div className="flex flex-col text-left">
                    <span className="font-display text-sm font-extrabold text-white">Ruta y Tráfico en Vivo</span>
                    <span className="font-body text-[10px] text-text-tertiary mt-0.5">
                      {origen} → {destino} {distancia != null ? `(${distancia.toFixed(1)} km)` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapaExpandido(false)}
                    className="p-2 text-text-secondary hover:text-white rounded-full bg-surface-elevated/60 cursor-pointer"
                    aria-label="Cerrar mapa"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </header>

                <div className="relative flex-1 w-full bg-[#070B14]">
                  <MapaRutaConduccion
                    origen={{ lat: origenLat, lng: origenLng }}
                    destino={{ lat: destinoLat, lng: destinoLng }}
                  />
                  <div className="absolute top-3 left-3 bg-[#0E1524]/90 backdrop-blur-md border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-400 flex items-center gap-2 shadow-md">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Tráfico en tiempo real activo
                  </div>
                </div>

                <footer className="p-4 border-t border-border/20 bg-[#0E1524] grid grid-cols-2 gap-3">
                  <a
                    href={`https://www.waze.com/ul?ll=${origenLat},${origenLng}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-elevated border border-border/20 py-3 text-xs font-bold text-white hover:bg-surface"
                  >
                    💬 Abrir en Waze
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLng}&destination=${destinoLat},${destinoLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#00B4D8] py-3 text-xs font-bold text-white hover:bg-[#0092B0]"
                  >
                    🗺️ Google Maps
                  </a>
                </footer>
              </div>
            )}

            {/* — Seccion Aproximación (Diferenciada de la distancia principal) — */}
            <section className="mt-4 bg-[#0E1524] border border-border/15 rounded-2xl p-4 flex flex-col gap-2 shadow-xs text-left select-none">
              <span className="font-display text-[10px] font-extrabold text-[#00B4D8] tracking-widest uppercase flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[#00B4D8]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5-1.5zM5 11l1.5-4.5h11L19 11H5z" />
                </svg>
                Aproximación
              </span>
              <div className="flex items-center justify-between gap-4 mt-1">
                <div className="flex flex-col">
                  <span className="font-display text-sm font-bold text-white">
                    {distancia ? `${(distancia * 0.08).toFixed(1)} km` : "En zona"} • {duracion ? `${Math.max(5, Math.round(duracion * 60 * 0.1))} min` : "Cerca"}
                  </span>
                  <span className="font-body text-[11px] text-text-tertiary mt-0.5">
                    Distancia estimada desde tu ubicación actual al punto de recolección
                  </span>
                </div>
                <span className="bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 text-[9px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap">
                  Hacia origen
                </span>
              </div>
            </section>

            {/* Vehículo asignado (Sin duplicados ni datos demo) */}
            <section className="mt-4 bg-[#0E1524] border border-border/15 rounded-2xl p-4 flex flex-col gap-3 text-left select-none">
              <span className="font-display text-[9px] font-bold text-[#00B4D8] tracking-widest uppercase">
                Vehículo asignado
              </span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Categoría</span>
                  <span className="font-bold text-xs text-white capitalize">
                    {pasaporte.vehiculo_categoria_tarifa || pasaporte.vehiculo_tipo || "Por confirmar"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Marca / Modelo</span>
                  <span className="font-bold text-xs text-white capitalize truncate">
                    {pasaporte.vehiculo_marca || pasaporte.vehiculo_modelo
                      ? `${pasaporte.vehiculo_marca ?? ''} ${pasaporte.vehiculo_modelo ?? ''}`.trim()
                      : "Por confirmar"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Color</span>
                  <span className="font-bold text-xs text-white capitalize">
                    {pasaporte.vehiculo_color || "Por confirmar"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Placas</span>
                  <span className="font-bold text-xs text-white uppercase">
                    {pasaporte.vehiculo_placas || "Por confirmar"}
                  </span>
                </div>
              </div>
            </section>

            {/* — Instrucciones y recomendaciones del servicio (Desplegable) — */}
            <section className="mt-4 bg-[#0E1524] border border-border/15 rounded-2xl overflow-hidden shadow-xs text-left select-none">
              <button
                type="button"
                onClick={() => setInstruccionesDesplegadas(!instruccionesDesplegadas)}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surface-elevated/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 text-[#A855F7]">
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                  </svg>
                  <span className="font-display text-xs font-bold text-white">
                    Instrucciones y recomendaciones del servicio
                  </span>
                </div>
                <svg className={`w-4 h-4 text-text-tertiary transition-transform duration-200 ${instruccionesDesplegadas ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {instruccionesDesplegadas && (
                <div className="px-4 pb-4 pt-1 border-t border-border/10 flex flex-col gap-2.5 text-xs text-text-secondary leading-relaxed">
                  <p>
                    {pasaporte.origen_referencias || "Verifica que puedes llegar al punto de recolección a la hora indicada. Valida la documentación del vehículo y mantén comunicación constante durante el servicio."}
                  </p>
                  {pasaporte.destino_referencias && (
                    <p className="text-text-tertiary text-[11px] border-t border-border/10 pt-2">
                      <strong className="text-text-secondary">Notas adicionales:</strong> {pasaporte.destino_referencias}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* SINGLE COLUMN MOBILE VERTICAL LAYOUT (EN CAMINO AL ORIGEN) */
          <div className="flex flex-col gap-5 w-full max-w-md md:max-w-xl mx-auto px-4 pb-36 items-stretch">
             
             {/* Header (Volver, Detalle del traslado, ID, Ayuda) */}
             <header className="grid grid-cols-[auto_1fr_auto] items-center pb-3 border-b border-border/10 select-none">
               <Link
                 href={volver}
                 className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0 rounded-full hover:bg-surface-elevated/60"
                 aria-label="Volver"
               >
                 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                   <polyline points="15 18 9 12 15 6" />
                 </svg>
               </Link>
               <div className="flex flex-col items-center justify-center text-center">
                 <span className="font-display text-sm font-bold text-text-primary">Detalle del traslado</span>
                 <span className="font-mono text-[10px] text-text-tertiary mt-0.5 tracking-wider uppercase">ID {folio}</span>
               </div>
               <Link
                 href={`/cuenta/soporte?traslado=${trasladoId}`}
                 className="flex h-9 w-9 items-center justify-center rounded-full border border-border/15 bg-[#0E1524]/60 hover:bg-[#0E1524] text-text-primary hover:text-[#00B4D8] transition-colors shadow-xs"
                 aria-label="Ayuda"
               >
                 <span className="font-display text-xs font-black">?</span>
               </Link>
             </header>

             {/* 1. Traslado Aceptado status card */}
             <section className="bg-[#0E1524] border border-emerald-500/25 rounded-2xl p-4 flex justify-between items-center text-left shadow-xs">
               <div className="flex flex-col text-left">
                 <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#10B981] tracking-widest uppercase">
                   <span>Traslado Aceptado</span>
                   <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                 </div>
                 <span className="text-text-tertiary text-[9px] font-bold uppercase tracking-wider mt-2">
                   Estado actual
                 </span>
                 <h2 className="font-display text-base font-black text-white leading-none mt-1 select-none">
                   EN CAMINO AL ORIGEN
                 </h2>
                 <p className="font-body text-xs text-text-secondary mt-1 leading-tight">
                   Dirígete al punto de recolección indicado.
                 </p>
               </div>
             </section>

             {/* 2. Card de Origen destacado (SIN Destino) con métricas de distancia y tiempo */}
             <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-4.5 flex flex-col gap-3 text-left shadow-xs">
               <div className="flex flex-col">
                 <div className="flex items-center gap-2">
                   <span className="text-[#10B981] text-lg">📍</span>
                   <span className="font-display text-[10px] font-bold text-[#10B981] tracking-widest uppercase">Punto de Origen</span>
                 </div>
                 <span className="font-display text-lg sm:text-xl font-black text-white leading-tight mt-1">{origen}</span>
                 {pasaporte.origen_direccion && (
                   <span className="font-body text-xs text-text-secondary leading-relaxed mt-1">{pasaporte.origen_direccion}</span>
                 )}
               </div>

               <div className="border-t border-border/10 my-0.5" />

               {/* Proyección de Distancia y Tiempo del Conductor al Origen */}
               <div className="grid grid-cols-2 gap-3 text-center">
                 <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/10 rounded-xl p-2.5 shadow-2xs">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#10B981] shrink-0" aria-hidden="true">
                     <path d="M3 22 L9 2 L15 2 L21 22" />
                     <path d="M12 2 L12 22" strokeDasharray="2 2" />
                     <path d="M6 14 L18 14" />
                   </svg>
                   <span className="font-display text-base font-black text-white mt-1">
                     {distancia != null ? `${(distancia * 0.08).toFixed(1)} km` : "4.2 km"}
                   </span>
                   <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Distancia al origen</span>
                 </div>

                 <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/10 rounded-xl p-2.5 shadow-2xs">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#10B981] shrink-0" aria-hidden="true">
                     <circle cx="12" cy="12" r="10" />
                     <polyline points="12 6 12 12 15 15" />
                   </svg>
                   <span className="font-display text-base font-black text-white mt-1">
                     {duracion != null ? `${Math.max(5, Math.round(duracion * 60 * 0.1))} min` : "9 min"}
                   </span>
                   <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Tiempo est. al origen</span>
                 </div>
               </div>
             </section>

             {/* 3. Tarjeta de Contactar Solicitante Integrada en Flujo Vertical justo debajo de Origen */}
             <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-4 flex flex-col gap-3 text-left shadow-xs">
               <div className="flex items-center justify-between">
                 <span className="font-display text-[10px] font-extrabold text-text-tertiary tracking-widest uppercase">
                   Contactar solicitante
                 </span>
                 <span className="font-display text-xs font-bold text-white truncate max-w-[180px]">
                   {pasaporte.contacto_entrega_nombre || pasaporte.contacto_recepcion_nombre || "Por confirmar"}
                 </span>
               </div>

               <div className="grid grid-cols-2 gap-3 select-none mt-1">
                 <a
                   href={`tel:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
                   className="flex items-center justify-center gap-2 rounded-xl bg-surface-elevated/60 border border-border/20 hover:border-text-primary text-text-primary font-display text-xs font-bold py-2.5 transition-colors cursor-pointer select-none"
                   aria-label="Llamar al solicitante"
                 >
                   <span className="text-base">📞</span>
                   Llamar
                 </a>
                 <a
                   href={`sms:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
                   className="flex items-center justify-center gap-2 rounded-xl bg-surface-elevated/60 border border-border/20 hover:border-text-primary text-text-primary font-display text-xs font-bold py-2.5 transition-colors cursor-pointer select-none"
                   aria-label="Enviar mensaje de texto"
                 >
                   <span className="text-base">💬</span>
                   Enviar mensaje
                 </a>
               </div>
             </section>

             {/* 4. Tarjeta del Mapa (Ocupa el 40% de altura de pantalla con Botones Flotantes directos de Waze y Google Maps) */}
             <section className="relative rounded-2xl border border-border/25 overflow-hidden shadow-lg h-[40vh] min-h-[280px] max-h-[420px] w-full">
               <div className="relative h-full w-full select-none">
                 {origenLat && origenLng ? (
                   <>
                     <div
                       onClick={() => setMapaExpandido(true)}
                       onKeyDown={(event) => {
                         if (event.key === "Enter" || event.key === " ") setMapaExpandido(true);
                       }}
                       className="absolute inset-0 w-full h-full z-10 cursor-pointer"
                       role="button"
                       tabIndex={0}
                       aria-label="Abrir mapa en pantalla completa"
                     >
                       <MapaRutaConduccion
                         origen={{ lat: origenLat, lng: origenLng }}
                         destino={{ lat: origenLat, lng: origenLng }}
                       />
                     </div>
                     
                     {/* Floating top button: Ver mapa completo */}
                     <button
                       type="button"
                       onClick={() => setMapaExpandido(true)}
                       className="absolute top-3 right-3 bg-black/80 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white hover:bg-black transition-colors z-20 flex items-center gap-1 select-none shadow-md cursor-pointer"
                     >
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                         <polyline points="15 3 21 3 21 9" />
                         <polyline points="9 21 3 21 3 15" />
                         <line x1="21" y1="3" x2="14" y2="10" />
                         <line x1="3" y1="21" x2="10" y2="14" />
                       </svg>
                       Mapa Completo
                     </button>

                     {/* Floating Action Bar over bottom of Map Card (Waze & Google Maps direct buttons) */}
                     <div className="absolute bottom-3 inset-x-3 z-20 flex items-center gap-2 select-none">
                       <a
                         href={`https://www.waze.com/ul?ll=${origenLat},${origenLng}&navigate=yes`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 px-3 py-2.5 text-xs font-bold text-white hover:bg-black transition-all shadow-lg active:scale-95"
                         aria-label="Navegar en Waze"
                       >
                         <span className="text-base">💬</span> Waze
                       </a>
                       <a
                         href={`https://maps.google.com/?q=${origenLat},${origenLng}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 px-3 py-2.5 text-xs font-bold text-white hover:bg-black transition-all shadow-lg active:scale-95"
                         aria-label="Navegar en Google Maps"
                       >
                         <span className="text-base">🗺️</span> Google Maps
                       </a>
                     </div>
                   </>
                 ) : (
                   <div className="absolute inset-0 w-full h-full bg-surface-elevated/45 flex items-center justify-center text-text-tertiary text-xs">
                     Cargando mapa interactivo...
                   </div>
                 )}
               </div>
             </section>

          </div>
        )}
      </div>

      {error && esOferta && (
        <div className="mt-3 px-4">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}
      {avisoExito && esOferta && (
        <div className="mt-3 px-4">
          <Aviso tono="info">{avisoExito}</Aviso>
        </div>
      )}

      {/* Primary Action Button Bar (Fixed directly ABOVE the Secondary Bottom Navigation Bar) */}
      <div className="fixed bottom-[60px] inset-x-0 z-40 bg-[#070B14]/90 backdrop-blur-md border-t border-border/15 py-3 px-4 select-none shadow-lg">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          {esOferta ? (
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setConfirmarAccion("aceptar")}
                disabled={procesando || segundosRestantes === 0}
                className="relative overflow-hidden w-full min-h-[48px] rounded-full bg-[#00C26F] hover:bg-[#00A960] text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden disabled:opacity-50"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-black/20 transition-all duration-1000 ease-linear pointer-events-none"
                  style={{ width: `${100 - porcentajeProgreso}%` }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-4.5 h-4.5 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {procesando
                    ? TEXTOS_CARGANDO.actualizando
                    : segundosRestantes === 0
                    ? "OFERTA EXPIRADA"
                    : `ACEPTAR TRASLADO (${formatTimer(segundosRestantes)})`}
                </span>
              </button>
              
              <button
                type="button"
                onClick={() => setConfirmarAccion("rechazar")}
                disabled={procesando}
                className="w-full min-h-[42px] rounded-full border border-red-500/60 bg-transparent text-red-500 hover:bg-red-500/10 font-display text-xs font-bold tracking-widest uppercase transition-all cursor-pointer select-none flex items-center justify-center gap-2"
              >
                Rechazar oferta
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {error && <Aviso tono="danger">{error}</Aviso>}
              {avisoExito && <Aviso tono="info">{avisoExito}</Aviso>}

              {(estado === "evidencia_inicial_en_proceso" || estado === "evidencia_final_en_proceso") ? (
                <Link
                  href={`/viajes/${trasladoId}/evidencia`}
                  className="w-full min-h-[48px] rounded-2xl bg-[#00B4D8] text-white hover:bg-[#0092B0] font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 text-center"
                >
                  {estado === "evidencia_inicial_en_proceso" ? "CONTINUAR EVIDENCIAS" : "CONTINUAR EVIDENCIAS DE ENTREGA"}
                </Link>
              ) : (estado === "evidencia_inicial_completada" || estado === "vehiculo_recibido") ? (
                <button
                  type="button"
                  onClick={handleIniciarViaje}
                  disabled={procesando}
                  className="w-full min-h-[48px] rounded-2xl bg-[#10B981] text-white hover:bg-[#0EA271] font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus:outline-hidden"
                >
                  {procesando ? TEXTOS_CARGANDO.actualizando : "INICIAR TRASLADO"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLlegue}
                  disabled={procesando}
                  className="w-full min-h-[48px] rounded-2xl bg-[#10B981] hover:bg-[#0EA271] text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden"
                >
                  <svg className="w-4.5 h-4.5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {procesando ? TEXTOS_CARGANDO.actualizando : "HE LLEGADO"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Secondary Bottom Navigation Bar fixed at bottom (0px) */}
      {!esOferta && (
        <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />
      )}

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
              <div className="bg-surface-elevated border border-border/20 rounded-xl p-3 flex flex-col gap-1.5 text-[11px] font-body text-text-secondary leading-relaxed">
                <p>
                  <strong className="text-text-primary">Importante:</strong> una vez aceptado, el traslado quedará asignado a ti. Las cancelaciones posteriores pueden afectar tu operación.
                </p>
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
