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

  const origen = pasaporte.origen_ciudad || "Por confirmar";
  const destino = pasaporte.destino_ciudad || "Por confirmar";
  const distancia = pasaporte.distancia_km;
  const duracion = pasaporte.tiempo_estimado_horas;
  const fechaReferencia = pasaporte.creado_en ?? pasaporte.actualizado_en ?? new Date().toISOString();
  const horaTexto = new Intl.DateTimeFormat("es-MX", { 
    hour: "2-digit", 
    minute: "2-digit", 
    hour12: false, 
    timeZone: "America/Mexico_City" 
  }).format(new Date(fechaReferencia));

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
         <header className="flex justify-between items-center pb-4 border-b border-border/20">
           <nav aria-label="Ruta de navegación" className="flex items-center gap-0.5">
             <Link
               href={volver}
               className="p-1 text-text-secondary hover:text-text-primary transition-colors shrink-0"
               aria-label="Volver"
             >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                 <polyline points="15 18 9 12 15 6" />
               </svg>
             </Link>
             <span className="text-text-tertiary" aria-hidden>/</span>
             <Link
               href="/viajes"
               className="font-body text-[10px] font-semibold text-text-tertiary hover:text-text-primary transition-colors"
             >
               Traslados
             </Link>
             <span className="text-text-tertiary" aria-hidden>/</span>
             <span className="font-body text-[10px] font-semibold text-text-primary truncate max-w-[100px]">
               {folio}
             </span>
           </nav>
           
           <div className="flex items-center gap-1.5 bg-[#1C2C24] border border-[#234D37] px-2.5 py-0.5 rounded-md">
             <span className="font-display text-[10px] font-black text-[#00B4D8] tracking-wider uppercase">CONDUCTOR</span>
           </div>

           <Link
            href={`/cuenta/soporte?traslado=${trasladoId}`}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0"
            aria-label="Soporte"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </Link>
          <Link 
            href="/cuenta" 
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors shrink-0" 
            aria-label="Ajustes de cuenta"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </Link>
        </header>

        {/* Title */}
        <div className="mt-6 flex flex-col">
          <span className="font-display text-base font-extrabold text-[#00B4D8] uppercase tracking-wider">
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
            <div className="w-2.5 h-2.5 rounded-full bg-[#00B4D8] border border-[#00B4D8]/60 z-10" />
          </div>

          <div className="text-center font-body text-[10px] font-bold text-text-tertiary">
            {distancia != null ? `${distancia.toFixed(1)} KM` : "Por confirmar"}
          </div>
        </div>

        {/* Details Grid (4 Columns) */}
        <div className="mt-6 grid grid-cols-4 gap-1 border border-border/40 bg-surface-elevated/45 rounded-2xl p-4 text-center">
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-black text-text-primary">{horaTexto}</span>
            <span className="font-body text-[8px] font-black text-text-tertiary uppercase tracking-wider">HORA</span>
          </div>
          <div className="flex flex-col gap-1.5 border-l border-border/20">
            <span className="font-display text-sm font-black text-text-primary">{duracion != null ? `${duracion.toFixed(2)} hr` : "Por confirmar"}</span>
            <span className="font-body text-[8px] font-black text-text-tertiary uppercase tracking-wider">DURACIÓN</span>
          </div>
          <div className="flex flex-col gap-1.5 border-l border-border/20">
            <span className="font-display text-sm font-black text-text-primary">{distancia != null ? `${distancia.toFixed(1)} km` : "Por confirmar"}</span>
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
              className="flex-1 min-h-12 rounded-xl bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none"
            >
              RECHAZAR
            </button>
          </section>
        ) : (
          <section className="mt-6 flex flex-col gap-3">
            {(estado === "evidencia_inicial_en_proceso" || estado === "evidencia_final_en_proceso") ? (
              <Link
                href={`/viajes/${trasladoId}/evidencia`}
                className="w-full min-h-12 rounded-xl bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 text-center"
              >
                {estado === "evidencia_inicial_en_proceso" ? "CONTINUAR EVIDENCIAS" : "CONTINUAR EVIDENCIAS DE ENTREGA"}
              </Link>
            ) : (estado === "evidencia_inicial_completada" || estado === "vehiculo_recibido") ? (
              <button
                type="button"
                onClick={handleIniciarViaje}
                disabled={procesando}
                className="w-full min-h-12 rounded-xl bg-route-action text-white hover:bg-route-action/90 font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5"
              >
                {procesando ? TEXTOS_CARGANDO.actualizando : "INICIAR TRASLADO"}
              </button>
            ) : (
              <>
                <div className="flex gap-3">
                  {/* RECOLECCIÓN Button with location icon */}
                  <a
                    href={navigationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface border border-border/40 text-text-primary font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary shrink-0" aria-hidden="true">
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
                    className="flex-1 min-h-12 rounded-xl bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 disabled:opacity-50 disabled:cursor-not-allowed font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center"
                  >
                    {procesando ? TEXTOS_CARGANDO.actualizando : "ESTOY EN CAMINO"}
                  </button>
                </div>

                {/* CONTACTAR USUARIO Button */}
                <a
                  href={`tel:${pasaporte.contacto_entrega_telefono || pasaporte.contacto_recepcion_telefono || ""}`}
                  className="w-full min-h-12 rounded-xl bg-transparent hover:bg-surface-elevated/20 border border-[#00B4D8]/40 text-[#00B4D8] font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center active:scale-98 cursor-pointer"
                >
                  CONTACTAR USUARIO
                </a>
              </>
            )}
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
            <span className="font-display text-2xl font-black text-white">${pagoTotal != null ? pagoTotal.toFixed(2) : "0.00"}</span>
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
              <div className="absolute -left-12 top-0.5 w-7 h-7 rounded-full bg-[#1C2C24] border border-[#234D37] text-[#00B4D8] flex items-center justify-center font-display text-xs font-black shadow-xs select-none">
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
        {!esOferta && (estado === "conductor_asignado" || estado === "conductor_en_camino_al_origen") && (
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

    </div>
  );
}
