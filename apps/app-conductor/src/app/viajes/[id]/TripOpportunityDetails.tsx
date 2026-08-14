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

  const trasladoId = pasaporte.traslado_id!;
  const folio = trasladoId.slice(0, 8).toUpperCase();
  const estado = pasaporte.estado as Database["public"]["Enums"]["estado_traslado"];
  const esOferta = estado === "pendiente_de_conductor" || !pasaporte.conductor_id;

  const origen = pasaporte.origen_ciudad || "San Mateo Atenco";
  const destino = pasaporte.destino_ciudad || "Tuxtla Gutiérrez";
  const distancia = pasaporte.distancia_km || 885.2;
  const duracion = pasaporte.tiempo_estimado_horas || 12.72;

  // Format Time
  const fechaReferencia = pasaporte.creado_en ?? pasaporte.actualizado_en ?? new Date().toISOString();
  const horaTexto = new Intl.DateTimeFormat("es-MX", { 
    hour: "2-digit", 
    minute: "2-digit", 
    hour12: false, 
    timeZone: "America/Mexico_City" 
  }).format(new Date(fechaReferencia));

  // Earning
  const pagoTotal = pasaporte.ganancia_conductor || 582.96;

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
        throw new Error("Inicia sesión para poder aceptar viajes.");
      }
      
      await aceptarViaje(cliente, trasladoId, session.user.id);
      setAvisoExito("¡Viaje aceptado! Agregado a tus traslados asignados.");
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
      await avanzarEstadoTraslado(cliente, trasladoId, "conductor_asignado");
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
      const estadoActual = pasaporte.estado as Database["public"]["Enums"]["estado_traslado"];
      
      if (estadoActual === "conductor_asignado") {
        await avanzarEstadoTraslado(cliente, trasladoId, "conductor_asignado");
        await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_camino_al_origen");
      } else {
        await avanzarEstadoTraslado(cliente, trasladoId, "conductor_en_camino_al_origen");
      }
      
      setAvisoExito("¡Has llegado al punto de recolección!");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada."));
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
        <header className="flex justify-between items-center pb-4 border-b border-border/20">
          <Link 
            href={volver} 
            className="p-1.5 text-text-primary hover:text-signal transition-colors shrink-0"
            aria-label="Volver"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          
          <div className="flex items-center gap-1.5 bg-[#1C2C24] border border-[#234D37] px-2.5 py-0.5 rounded-md">
            <span className="font-display text-[10px] font-black text-[#00BBC9] tracking-wider uppercase">CONDUCTOR</span>
          </div>

          <Link
            href={`/cuenta/soporte?traslado=${trasladoId}`}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0"
            aria-label="Soporte"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </Link>
          <Link 
            href="/cuenta" 
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0" 
            aria-label="Ajustes de cuenta"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </Link>
        </header>

        {/* Title */}
        <div className="mt-6 flex flex-col">
          <span className="font-display text-base font-extrabold text-[#00BBC9] uppercase tracking-wider">
            TRASLADO ID {folio}
          </span>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-1">
            Detalles del traslado
          </h1>
        </div>

        {/* Route Preview with Dashed Line and Truck */}
        <div className="mt-8 flex flex-col gap-2 bg-surface-elevated/20 border border-border/30 rounded-2xl p-5">
          <div className="flex justify-between items-center text-text-primary font-display text-sm font-bold">
            <span>{origen}</span>
            <span>{destino}</span>
          </div>
          
          {/* Dashed Line representation */}
          <div className="relative flex items-center justify-between w-full h-8 my-1 px-1">
            {/* Left Dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-white border border-border/60 z-10" />
            
            {/* Center Dashed Border */}
            <div className="absolute left-3 right-3 border-t border-dashed border-border/60 z-0 flex justify-center items-center">
              {/* Floating Truck Icon */}
              <span className="absolute -top-3.5 text-base bg-surface px-1 select-none pointer-events-none">🚚</span>
            </div>
            
            {/* Right Dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-[#00BBC9] border border-[#00BBC9]/60 z-10" />
          </div>

          <div className="text-center font-body text-[10px] font-bold text-text-tertiary">
            {distancia.toFixed(1)} KM
          </div>
        </div>

        {/* Details Grid (4 Columns) */}
        <div className="mt-6 grid grid-cols-4 gap-1 border border-border/40 bg-surface-elevated/45 rounded-2xl p-4 text-center">
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-black text-text-primary">{horaTexto}</span>
            <span className="font-body text-[8px] font-black text-text-tertiary uppercase tracking-wider">HORA</span>
          </div>
          <div className="flex flex-col gap-1.5 border-l border-border/20">
            <span className="font-display text-sm font-black text-text-primary">{duracion.toFixed(2)} hr</span>
            <span className="font-body text-[8px] font-black text-text-tertiary uppercase tracking-wider">DURACIÓN</span>
          </div>
          <div className="flex flex-col gap-1.5 border-l border-border/20">
            <span className="font-display text-sm font-black text-text-primary">{distancia.toFixed(1)} km</span>
            <span className="font-body text-[8px] font-black text-text-tertiary uppercase tracking-wider">DISTANCIA</span>
          </div>
          <div className="flex flex-col gap-1.5 border-l border-border/20">
            <span className="font-display text-sm font-black text-text-primary">01 / 01</span>
            <span className="font-body text-[8px] font-black text-text-tertiary uppercase tracking-wider">VEHÍCULOS</span>
          </div>
        </div>

        <p className="mt-3 text-center font-body text-[10px] text-text-tertiary leading-relaxed">
          El tiempo puede variar según el tráfico, el clima u otros retrasos.
        </p>

        {/* Actions Section */}
        {esOferta ? (
          <section className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleAceptar}
              disabled={procesando}
              className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface border border-border/40 text-text-primary font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-xs select-none"
            >
              {procesando ? TEXTOS_CARGANDO.actualizando : "ACEPTAR"}
            </button>
            <button
              type="button"
              onClick={handleRechazar}
              className="flex-1 min-h-12 rounded-xl bg-[#00BBC9] text-white hover:bg-[#00BBC9]/90 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none"
            >
              RECHAZAR
            </button>
          </section>
        ) : (
          <section className="mt-6 flex flex-col gap-3">
            <div className="flex gap-3">
              {/* RECOLECCIÓN Button with location icon */}
              <a
                href={navigationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface border border-border/40 text-text-primary font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary shrink-0">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                RECOLECCIÓN
              </a>

              {/* ESTOY EN CAMINO Button */}
              <button
                type="button"
                onClick={handleEstoyEnCamino}
                disabled={procesando || (estado !== "conductor_asignado")}
                className="flex-1 min-h-12 rounded-xl bg-[#00BBC9] text-white hover:bg-[#00BBC9]/90 disabled:opacity-50 disabled:cursor-not-allowed font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center"
              >
                {procesando ? TEXTOS_CARGANDO.actualizando : "ESTOY EN CAMINO"}
              </button>
            </div>

            {/* CONTACTAR USUARIO Button */}
            <a
              href={`tel:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
              className="w-full min-h-12 rounded-xl bg-transparent hover:bg-surface-elevated/20 border border-[#00BBC9]/40 text-[#00BBC9] font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center active:scale-98 cursor-pointer"
            >
              CONTACTAR USUARIO
            </a>
          </section>
        )}

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
        <section className="mt-6 bg-[#2B2317] border border-[#523F27] rounded-2xl p-5 flex flex-col gap-2 relative">
          <span className="font-display text-[9px] font-black text-[#DCA24C] tracking-widest uppercase">
            PAGO POR ITINERARIO
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-display text-2xl font-black text-white">${pagoTotal.toFixed(2)}</span>
            <span className="font-body text-[10px] font-bold text-text-secondary">MXN total</span>
          </div>
        </section>

        {/* Transfer Notes Card */}
        <section className="mt-4 bg-surface-elevated/20 border border-border/20 rounded-2xl p-5 flex flex-col gap-2 relative">
          <span className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase">
            NOTAS DE TRASLADO
          </span>
          <p className="font-body text-xs leading-relaxed text-text-secondary mt-1">
            Incluye un bono de <strong className="text-[#DCA24C] font-black">$300.00 MXN</strong> por autoretorno (self-return). Para reclamarlo, selecciona la opción correspondiente en el sistema antes de iniciar el viaje.
          </p>
        </section>

        {/* Itinerario Section */}
        <section className="mt-6 flex flex-col gap-4 mb-8">
          <h2 className="font-display text-sm font-black text-text-tertiary tracking-widest uppercase">
            ITINERARIO DE RUTA
          </h2>

          <div className="flex flex-col relative pl-8 border-l border-border/60 ml-3.5 gap-6">
            
            {/* Punto 1: Origen */}
            <div className="relative flex flex-col gap-2">
              {/* Number Circle Marker */}
              <div className="absolute -left-12 top-0.5 w-7 h-7 rounded-full bg-[#1C2C24] border border-[#234D37] text-[#00BBC9] flex items-center justify-center font-display text-xs font-black shadow-xs select-none">
                1
              </div>

              <div className="flex flex-col">
                <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                  {origen}
                </h3>
                <span className="font-body text-[11px] text-text-tertiary mt-0.5">
                  {pasaporte.origen_direccion || "Calle de los Serrano 225, 400 Uno Residencial, 52104, México"}
                </span>
              </div>

              {/* Table details Card */}
              <div className="mt-2 rounded-xl border border-border/30 bg-surface-elevated/20 p-3.5 flex flex-col gap-2 text-xs font-body text-text-secondary">
                <div className="flex justify-between items-center">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1">📍 Origen</span>
                  <span className="text-text-primary font-medium">{origen}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border/10 pt-2">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1">📄 Formulario</span>
                  <span className="text-text-primary font-medium">Amazon</span>
                </div>
                <div className="flex justify-between items-center border-t border-border/10 pt-2">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1">🚗 Recolección vehículo</span>
                  <span className="border border-amber-500/40 text-amber-500 font-extrabold px-2 py-0.5 rounded-md text-[9px]">
                    POR CONFIRMAR
                  </span>
                </div>
              </div>
            </div>

            {/* Punto 2: Destino */}
            <div className="relative flex flex-col gap-2 mt-2">
              {/* Number Circle Marker */}
              <div className="absolute -left-12 top-0.5 w-7 h-7 rounded-full bg-surface-elevated text-text-secondary flex items-center justify-center font-display text-xs font-black shadow-xs select-none">
                2
              </div>

              <div className="flex flex-col">
                <h3 className="font-display text-sm font-bold text-text-primary leading-tight">
                  {destino}
                </h3>
                <span className="font-body text-[11px] text-text-tertiary mt-0.5">
                  {pasaporte.destino_direccion || "Av. de los Serranos 220, El Magueyito, 29000, Chiapas"}
                </span>
              </div>

              {/* Table details Card */}
              <div className="mt-2 rounded-xl border border-border/30 bg-surface-elevated/20 p-3.5 flex flex-col gap-2 text-xs font-body text-text-secondary">
                <div className="flex justify-between items-center">
                  <span className="text-text-tertiary font-semibold flex items-center gap-1">🏁 Entrega vehículo</span>
                  <span className="border border-amber-500/40 text-amber-500 font-extrabold px-2 py-0.5 rounded-md text-[9px]">
                    POR CONFIRMAR
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ¡Llegue! (link a paso 1) Button moved to the bottom */}
        {!esOferta && (
          <div className="mt-6 mb-8 w-full">
            <button
              type="button"
              onClick={handleLlegue}
              disabled={procesando}
              className="w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5"
            >
              <span>✓</span> ¡LLEGUE!
            </button>
          </div>
        )}

      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4">
        <nav
          aria-label="Navegación principal móvil"
          className="mx-auto max-w-md rounded-full border border-border/40 bg-surface-elevated/90 shadow-[0_8px_30px_rgba(0,0,0,0.2)] px-5 py-3.5 backdrop-blur-md"
        >
          <div className="grid grid-cols-3 gap-1">
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
          </div>
        </nav>
      </div>

    </div>
  );
}
