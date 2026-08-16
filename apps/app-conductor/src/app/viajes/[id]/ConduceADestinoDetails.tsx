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
import { SincronizacionBadge } from "../../../components/SincronizacionBadge";

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
  const [avisoExito, setAvisoExito] = useState<string | null>(null);
  const [soporteAbierto, setSoporteAbierto] = useState(false);

  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();

  const destino = pasaporte.destino_ciudad || "Tuxtla Gutiérrez";
  const destinoDireccion = pasaporte.destino_direccion || "Av. de los Serranos 220, El Magueyito, 29000, Chiapas";
  const contactoTelefono = pasaporte.contacto_recepcion_telefono || pasaporte.contacto_entrega_telefono || "55 4821 0937";

  // Description fallback
  const descripcionTexto = (pasaporte as any).instrucciones_especiales || 
    "Traslado sencillo, un pasajero. Vehículo debe entregarse con tanque lleno y sin daños adicionales a los reportados en la recolección. Cliente solicita confirmar llegada por llamada, no por mensaje.";

  // Navigation target
  const navigationTargetLat = pasaporte.destino_lat ?? 16.7569;
  const navigationTargetLng = pasaporte.destino_lng ?? -93.1292;
  const navigationUrl = `https://www.google.com/maps/dir/?api=1&destination=${navigationTargetLat},${navigationTargetLng}`;

  // Incident status
  const tieneIncidencia = pasaporte.tiene_incidencia_abierta || false;

  function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radio de la Tierra en Km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async function handleLlegueDestino() {
    setProcesando(true);
    setError(null);
    setAvisoExito(null);

    const ejecutarConfirmacion = async (fueraGeocerca: boolean, distanciaM: number | null) => {
      try {
        const cliente = crearClienteNavegador();
        
        // Query the freshest state from database to handle race conditions / double clicks
        const pasaporteFresco = await obtenerPasaporteDigital(cliente, trasladoId);
        const estadoDb = pasaporteFresco?.estado || pasaporte.estado;

        if (estadoDb === "evidencia_final_en_proceso") {
          setAvisoExito("Redirigiendo a evidencias de entrega...");
          setTimeout(() => {
            router.push(`/viajes/${trasladoId}/evidencia`);
          }, 800);
          return;
        }

        if (estadoDb === "traslado_en_curso") {
          // First: transition traslado_en_curso -> llegada_a_destino using dedicated RPC
          await confirmarLlegadaDestino(cliente, trasladoId, { fueraGeocerca, distanciaM });
          // Wait 300ms to allow Supabase transaction to finalize
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        
        // Second: transition llegada_a_destino -> evidencia_final_en_proceso
        await avanzarEstadoTraslado(cliente, trasladoId, "llegada_a_destino");
        
        setAvisoExito("¡Llegada a destino registrada! Redirigiendo a evidencias de entrega...");
        setTimeout(() => {
          router.push(`/viajes/${trasladoId}/evidencia`);
        }, 1000);
      } catch (err) {
        setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al destino."));
        setProcesando(false);
      }
    };

    // 1. Proximity validation using GPS
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latConductor = position.coords.latitude;
          const lngConductor = position.coords.longitude;
          const distanciaKm = calcularDistanciaKm(
            latConductor,
            lngConductor,
            navigationTargetLat,
            navigationTargetLng
          );
          const distanciaM = Math.round(distanciaKm * 1000);

          // If driver is more than 500m away, ask for explicit confirmation
          if (distanciaM > 500) {
            const distanciaTexto = distanciaKm < 1 
              ? `${distanciaM} metros` 
              : `${distanciaKm.toFixed(1)} km`;
            
            const seguro = window.confirm(
              `⚠️ AVISO DE GEOCERCA:\n\nTe encuentras a ${distanciaTexto} del destino programado.\n\n¿Estás seguro de que deseas registrar la llegada ahora? (Asegúrate de estar estacionado de forma segura).`
            );

            if (!seguro) {
              setProcesando(false);
              return;
            }
            await ejecutarConfirmacion(true, distanciaM);
          } else {
            await ejecutarConfirmacion(false, distanciaM);
          }
        },
        async (err) => {
          console.warn("No se pudo obtener la ubicación GPS exacta para geocerca:", err);
          const seguro = window.confirm(
            "¿Confirmas que has llegado físicamente al destino del traslado?"
          );
          if (!seguro) {
            setProcesando(false);
            return;
          }
          await ejecutarConfirmacion(false, null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const seguro = window.confirm(
        "¿Confirmas que has llegado físicamente al destino del traslado?"
      );
      if (!seguro) {
        setProcesando(false);
        return;
      }
      await ejecutarConfirmacion(false, null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-screen text-text-primary">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      <div className="w-full flex flex-col flex-1 animate-fade-in pb-24">
        
        {/* Top Navbar Header */}
        <header className="hidden md:flex justify-between items-center pb-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black tracking-tight text-white">
              ruum<span className="text-[#00B4D8]">ruum</span>
            </span>
            <div className="bg-[#1C2C24] border border-[#234D37] px-2 py-0.5 rounded-md">
              <span className="font-display text-[9px] font-black text-[#00B4D8] tracking-wider">CONDUCTOR</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button 
              type="button" 
              onClick={() => setSoporteAbierto(true)}
              className="p-1.5 text-text-primary hover:text-signal transition-colors cursor-pointer bg-transparent border-none outline-hidden" 
              aria-label="Soporte rápido"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary hover:text-text-primary transition-colors">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <Link 
              href="/cuenta" 
              className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0" 
              aria-label="Ajustes de cuenta"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.64-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Sync Status Banner */}
        <div className="mt-3">
          <SincronizacionBadge />
        </div>

        {/* Step Breadcrumbs Tracker */}
        <div className="mt-6 flex flex-col gap-1">
          <span className="font-body text-[10px] text-[#00B4D8] font-bold tracking-wide uppercase">
            MANIFIESTO DE RUTA · #UNO RESIDENCIAL
          </span>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-1">
            Trayecto activo
          </h1>
        </div>

        {/* Destination Details Card */}
        <div className="mt-6 flex flex-col bg-surface-elevated rounded-[1.5rem] border border-border/40 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
          <span className="font-display text-[10px] font-black text-emerald-500 tracking-wider uppercase">
            DESTINO
          </span>
          <h2 className="font-display text-2xl font-black text-text-primary mt-1">
            {destino}
          </h2>
          <p className="font-body text-xs text-text-secondary mt-1 leading-relaxed">
            {destinoDireccion}
          </p>

          {/* Metrics Card Grid (3 Columns) */}
          <div className="mt-6 grid grid-cols-3 gap-2 border border-border/30 bg-surface-elevated/45 rounded-xl p-4 text-center">
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-lg leading-none">🛣️</span>
              <span className="font-display text-sm font-bold text-text-primary">98 km</span>
              <span className="font-body text-[9px] text-text-tertiary uppercase tracking-wide">Restantes</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 border-l border-border/25">
              <span className="text-lg leading-none">⏱️</span>
              <span className="font-display text-sm font-bold text-text-primary">1.4 hr</span>
              <span className="font-body text-[9px] text-text-tertiary uppercase tracking-wide">Tiempo</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 border-l border-border/25">
              <span className="text-lg leading-none">🏁</span>
              <span className="font-display text-sm font-bold text-text-primary">10:42</span>
              <span className="font-body text-[9px] text-text-tertiary uppercase tracking-wide">Llegada</span>
            </div>
          </div>

          {/* Contact Actions Grid */}
          <div className="mt-5 flex gap-2.5 w-full">
            <a
              href={`tel:${contactoTelefono}`}
              className="flex-1 min-h-10 rounded-xl bg-surface-elevated/80 border border-border/40 hover:bg-surface-elevated text-text-primary font-display text-[10px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              LLAMAR USUARIO
            </a>
            <a
              href={`https://wa.me/52${contactoTelefono.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-display text-[10px] font-black tracking-wide flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              WHATSAPP
            </a>
          </div>
        </div>

        {/* Map Canvas Card */}
        <div className="mt-6 flex flex-col rounded-[1.5rem] border border-border/30 bg-surface-elevated/20 p-5 relative overflow-hidden">
          <MapaRutaConduccion
            origen={{ lat: pasaporte.origen_lat ?? 19.2833, lng: pasaporte.origen_lng ?? -99.5167 }}
            destino={{ lat: pasaporte.destino_lat ?? 16.7569, lng: pasaporte.destino_lng ?? -93.1292 }}
          />
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

        <div className="mt-6 flex flex-col gap-3.5">
          <span className="font-display text-[10px] font-black text-text-tertiary tracking-widest uppercase">
            DETALLES DEL TRASLADO
          </span>

          {/* Description Card */}
          <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl p-4.5 flex gap-3 text-xs font-body leading-relaxed text-text-secondary">
            <span className="text-xl leading-none">📖</span>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-text-primary text-[13px]">Descripción</span>
              <p className="mt-0.5">{descripcionTexto}</p>
            </div>
          </div>

          {/* Incidences Card */}
          <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl p-4.5 flex gap-3 text-xs font-body leading-relaxed text-text-secondary">
            <span className="text-xl leading-none">⚠️</span>
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-text-primary text-[13px]">Incidencia</span>
                <span className={`font-extrabold px-2 py-0.5 rounded-md text-[9px] border ${
                  tieneIncidencia
                    ? "border-amber-500/40 text-amber-500 bg-amber-500/10"
                    : "border-border/40 text-text-tertiary bg-surface-elevated/30"
                }`}>
                  {tieneIncidencia ? "ABIERTA" : "NINGUNA"}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5">Reporta retrasos, desviaciones, fallas del vehículo o cualquier situación fuera de lo previsto.</p>

              <button
                type="button"
                onClick={() => router.push(`/viajes/${trasladoId}#reportar-incidencia`)}
                className="w-full mt-3.5 border border-dashed border-border/60 hover:border-signal/50 rounded-xl py-3 flex items-center justify-center text-text-secondary hover:text-text-primary font-display text-xs font-bold transition-all cursor-pointer select-none"
              >
                + REPORTAR INCIDENCIA
              </button>
            </div>
          </div>

        </div>

        <div className="text-center font-body text-[9px] text-text-tertiary font-bold mt-8 tracking-wide select-none">
          ruumruum · manifiesto generado para revisión de conductor
        </div>

        {/* Sticky footer for navigation & arrival actions */}
        <div className="sticky bottom-0 inset-x-0 z-20 bg-[#090D1A]/95 backdrop-blur-md border-t border-border/20 py-4 px-4 -mx-4 sm:-mx-6 flex gap-3 mt-8">
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface-elevated/20 border border-[#00BBC9]/60 text-[#00BBC9] font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center gap-2 cursor-pointer shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#00BBC9] focus-visible:ring-offset-2"
          >
            {/* Map/GPS SVG Icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            NAVEGAR
          </a>
          <button
            type="button"
            onClick={handleLlegueDestino}
            disabled={procesando}
            className="flex-[2] min-h-12 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-white font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#10B981] focus-visible:ring-offset-2"
          >
            {procesando ? TEXTOS_CARGANDO.actualizando : "HE LLEGADO"}
          </button>
        </div>

      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-4 z-40 md:hidden px-4">
        <nav
          aria-label="Navegación principal móvil"
          className="mx-auto max-w-md rounded-full border border-border/40 bg-surface-elevated/90 shadow-[0_8px_30px_rgba(0,0,0,0.2)] px-5 py-3.5 backdrop-blur-md"
        >
          <div className="grid grid-cols-4 gap-1">
            <Link
              href="/panel"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              <span>Inicio</span>
            </Link>

            <Link
              href="/viajes"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-signal font-extrabold transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" y1="3" x2="9" y2="18" />
                <line x1="15" y1="6" x2="15" y2="21" />
              </svg>
              <span>Traslados</span>
            </Link>

            <Link
              href="/ganancias"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Ganancias</span>
            </Link>

            <Link
              href="/cuenta"
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 font-body text-xs text-text-secondary hover:text-text-primary transition-colors select-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <span>Cuenta</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Bottom Sheet de Soporte */}
      {soporteAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop de cierre */}
          <button 
            type="button" 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-default w-full h-full border-none outline-hidden" 
            onClick={() => setSoporteAbierto(false)}
            aria-label="Cerrar soporte"
          />
          {/* Tarjeta de contenido */}
          <div className="relative w-full max-w-md bg-surface-elevated rounded-t-[2rem] border-t border-border/40 p-6 flex flex-col gap-4 animate-slideUp shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-border/20">
              <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
                <span>💬</span> Soporte Rápido Ruum
              </h2>
              <button 
                type="button" 
                onClick={() => setSoporteAbierto(false)}
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <p className="font-body text-xs text-text-secondary">
              Selecciona un medio de contacto para comunicarte con el equipo operativo de guardia.
            </p>
            <div className="flex flex-col gap-2.5 mt-2">
              <a
                href="https://wa.me/525548210937"
                className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
              >
                <span className="text-xl">💬</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-emerald-400">WhatsApp de Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Mensajería instantánea y respuesta inmediata</span>
                </div>
              </a>
              <a
                href="tel:+525548210937"
                className="flex items-center gap-3 p-4 bg-route-soft border border-route-action/20 rounded-xl hover:bg-route-action/10 transition-colors"
              >
                <span className="text-xl">📞</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-route-action">Llamar a Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Habla por teléfono directamente con un operador</span>
                </div>
              </a>
              <a
                href="mailto:soporte@ruumruum.com"
                className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border/40 hover:bg-surface-elevated transition-colors"
              >
                <span className="text-xl">✉️</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-text-primary">Correo Electrónico</span>
                  <span className="font-body text-[11px] text-text-secondary">Reportar incidencias técnicas no urgentes</span>
                </div>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setSoporteAbierto(false)}
              className="w-full min-h-11 mt-2 rounded-xl bg-control-soft font-display text-sm font-bold text-text-primary hover:bg-border/60 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
