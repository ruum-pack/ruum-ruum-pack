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
  const [mapaExpandido, setMapaExpandido] = useState(false);

  const distancia = pasaporte.distancia_km;
  const duracion = pasaporte.tiempo_estimado_horas;
  const origenLat = pasaporte.origen_lat ?? 19.2833;
  const origenLng = pasaporte.origen_lng ?? -99.5167;

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
        const pasaporteFresco = await obtenerPasaporteDigital(cliente, trasladoId);
        const estadoDb = pasaporteFresco?.estado || pasaporte.estado;

        if (estadoDb === "evidencia_final_en_proceso") {
          setAvisoExito("Redirigiendo a evidencias de entrega...");
          setTimeout(() => {
            router.push(`/viajes/${trasladoId}/evidencia`);
          }, 600);
          return;
        }

        if (estadoDb === "traslado_en_curso") {
          await confirmarLlegadaDestino(cliente, trasladoId, { fueraGeocerca, distanciaM });
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        
        await avanzarEstadoTraslado(cliente, trasladoId, "llegada_a_destino");
        
        setAvisoExito("¡Llegada a destino registrada! Redirigiendo a evidencias de entrega...");
        setTimeout(() => {
          router.push(`/viajes/${trasladoId}/evidencia`);
        }, 800);
      } catch (err) {
        setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al destino."));
        setProcesando(false);
      }
    };

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
    <div className="mx-auto w-full max-w-md md:max-w-xl px-4 py-5 flex flex-col justify-between min-h-screen text-text-primary">
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
      ` }} />

      {/* SINGLE COLUMN MOBILE VERTICAL LAYOUT (EN CAMINO AL DESTINO) */}
      <div className="flex flex-col gap-5 w-full mx-auto pb-36 items-stretch animate-fade-in">
        
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

        {/* Sync Status Badge */}
        <SincronizacionBadge />

        {/* 1. Traslado en Curso status card */}
        <section className="bg-[#0E1524] border border-emerald-500/25 rounded-2xl p-4 flex justify-between items-center text-left shadow-xs">
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#10B981] tracking-widest uppercase">
              <span>Traslado en Curso</span>
              <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            </div>
            <span className="text-text-tertiary text-[9px] font-bold uppercase tracking-wider mt-2">
              Estado actual
            </span>
            <h2 className="font-display text-base font-black text-white leading-none mt-1 select-none">
              EN CAMINO AL DESTINO
            </h2>
            <p className="font-body text-xs text-text-secondary mt-1 leading-tight">
              Dirígete al punto de entrega indicado.
            </p>
          </div>
        </section>

        {/* 2. Card de Destino destacado (SIN Origen) con métricas de distancia y tiempo */}
        <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-4.5 flex flex-col gap-3 text-left shadow-xs">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[#10B981] text-lg">📍</span>
              <span className="font-display text-[10px] font-bold text-[#10B981] tracking-widest uppercase">Punto de Destino</span>
            </div>
            <span className="font-display text-lg sm:text-xl font-black text-white leading-tight mt-1">{destino}</span>
            {destinoDireccion && (
              <span className="font-body text-xs text-text-secondary leading-relaxed mt-1">{destinoDireccion}</span>
            )}
          </div>

          <div className="border-t border-border/10 my-0.5" />

          {/* Proyección de Distancia y Tiempo del Conductor al Destino */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/10 rounded-xl p-2.5 shadow-2xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#10B981] shrink-0" aria-hidden="true">
                <path d="M3 22 L9 2 L15 2 L21 22" />
                <path d="M12 2 L12 22" strokeDasharray="2 2" />
                <path d="M6 14 L18 14" />
              </svg>
              <span className="font-display text-base font-black text-white mt-1">
                {distancia != null ? `${distancia} km` : "98.0 km"}
              </span>
              <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Distancia al destino</span>
            </div>

            <div className="flex flex-col items-center justify-center bg-[#070B14] border border-border/10 rounded-xl p-2.5 shadow-2xs">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#10B981] shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 15 15" />
              </svg>
              <span className="font-display text-base font-black text-white mt-1">
                {duracion != null ? `${Math.round(duracion * 60)} min` : "84 min"}
              </span>
              <span className="font-body text-[9px] font-bold text-text-tertiary mt-0.5 uppercase tracking-wider">Tiempo est. al destino</span>
            </div>
          </div>
        </section>

        {/* 3. Tarjeta de Contactar Destinatario Integrada en Flujo Vertical justo debajo de Destino */}
        <section className="bg-[#0E1524] border border-border/15 rounded-2xl p-4 flex flex-col gap-3 text-left shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-display text-[10px] font-extrabold text-text-tertiary tracking-widest uppercase">
              Contactar destinatario
            </span>
            <span className="font-display text-xs font-bold text-white truncate max-w-[180px]">
              {pasaporte.contacto_recepcion_nombre || pasaporte.contacto_entrega_nombre || "Por confirmar"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 select-none mt-1">
            <a
              href={`tel:${contactoTelefono}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-surface-elevated/60 border border-border/20 hover:border-text-primary text-text-primary font-display text-xs font-bold py-2.5 transition-colors cursor-pointer select-none"
              aria-label="Llamar al destinatario"
            >
              <span className="text-base">📞</span>
              Llamar
            </a>
            <a
              href={`sms:${contactoTelefono}`}
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
            {navigationTargetLat && navigationTargetLng ? (
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
                    destino={{ lat: navigationTargetLat, lng: navigationTargetLng }}
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
                    href={`https://www.waze.com/ul?ll=${navigationTargetLat},${navigationTargetLng}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 px-3 py-2.5 text-xs font-bold text-white hover:bg-black transition-all shadow-lg active:scale-95"
                    aria-label="Navegar en Waze"
                  >
                    <span className="text-base">💬</span> Waze
                  </a>
                  <a
                    href={navigationUrl}
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

      {error && (
        <div className="mt-3 px-4">
          <Aviso tono="danger">{error}</Aviso>
        </div>
      )}
      {avisoExito && (
        <div className="mt-3 px-4">
          <Aviso tono="info">{avisoExito}</Aviso>
        </div>
      )}

      {/* Primary Action Button Bar (Fixed directly ABOVE the Secondary Bottom Navigation Bar) */}
      <div className="fixed bottom-[60px] inset-x-0 z-40 bg-[#070B14]/90 backdrop-blur-md border-t border-border/15 py-3 px-4 select-none shadow-lg">
        <div className="max-w-md mx-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={handleLlegueDestino}
            disabled={procesando}
            className="w-full min-h-[48px] rounded-2xl bg-[#10B981] hover:bg-[#0EA271] text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden"
          >
            <svg className="w-4.5 h-4.5 text-white shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {procesando ? TEXTOS_CARGANDO.actualizando : "HE LLEGADO AL DESTINO"}
          </button>
        </div>
      </div>

      {/* Secondary Bottom Navigation Bar fixed at bottom (0px) */}
      <SecondaryTripNavBar trasladoId={trasladoId} pasaporte={pasaporte} />

      {/* Fullscreen Map Modal */}
      {mapaExpandido && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black animate-fade-in">
          <div className="flex items-center justify-between p-4 bg-[#070B14] border-b border-border/20">
            <span className="font-display text-sm font-bold text-white">Ruta a Destino</span>
            <button
              type="button"
              onClick={() => setMapaExpandido(false)}
              className="px-3 py-1.5 rounded-xl bg-surface-elevated text-xs font-bold text-white hover:bg-surface"
            >
              Cerrar
            </button>
          </div>
          <div className="flex-1 w-full relative">
            <MapaRutaConduccion
              origen={{ lat: origenLat, lng: origenLng }}
              destino={{ lat: navigationTargetLat, lng: navigationTargetLng }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
