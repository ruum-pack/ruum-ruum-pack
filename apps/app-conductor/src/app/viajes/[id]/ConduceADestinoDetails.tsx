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

  async function handleLlegueDestino() {
    setProcesando(true);
    setError(null);
    setAvisoExito(null);
    try {
      const cliente = crearClienteNavegador();
      // In Ruum, "traslado_en_curso" transitions to "llegada_a_destino"
      await avanzarEstadoTraslado(cliente, trasladoId, "traslado_en_curso");
      setAvisoExito("¡Llegada a destino registrada exitosamente!");
      router.refresh();
    } catch (err) {
      setError(traducirErrorOperativo(err, "No pudimos registrar tu llegada al destino."));
    } finally {
      setProcesando(false);
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
        <header className="flex justify-between items-center pb-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-black tracking-tight text-white">
              ruum<span className="text-[#00BBC9]">ruum</span>
            </span>
            <div className="bg-[#1C2C24] border border-[#234D37] px-2 py-0.5 rounded-md">
              <span className="font-display text-[9px] font-black text-[#00BBC9] tracking-wider">CONDUCTOR</span>
            </div>
          </div>
          
          <nav className="flex items-center gap-4 text-xs font-body text-text-secondary">
            <Link href="/panel" className="hover:text-text-primary transition-colors">Inicio</Link>
            <Link href="/viajes" className="text-signal hover:text-text-primary transition-colors font-extrabold border-b-2 border-signal pb-0.5">Traslados</Link>
            <Link href="/ganancias" className="hover:text-text-primary transition-colors">Ganancias</Link>
          </nav>
        </header>

        {/* Step Breadcrumbs Tracker */}
        <div className="mt-6 flex flex-col gap-1">
          <span className="font-body text-[10px] text-[#00BBC9] font-bold tracking-wide uppercase">
            MANIFIESTO DE RUTA · #UNO RESIDENCIAL
          </span>
          <h1 className="font-display text-2xl font-black text-text-primary leading-tight mt-1">
            Conduce a
          </h1>
        </div>

        {/* Main Navigation Map Card */}
        <div className="mt-6 flex flex-col rounded-2xl overflow-hidden border border-[#162720] bg-gradient-to-b from-[#12231C]/60 to-[#0A1612]/80 relative p-5">
          
          {/* Estimated time indicator */}
          <div className="absolute top-4 right-5 text-right">
            <span className="font-body text-[10px] text-text-tertiary">Llegada estimada</span>
            <span className="font-display text-[10px] font-black text-[#00BBC9] block">10:42</span>
          </div>

          {/* Wavy route vector */}
          <div className="h-20 w-full relative flex items-center justify-center my-2">
            <svg width="100%" height="40" viewBox="0 0 300 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute">
              <path d="M0 20C50 20 100 5 150 20C200 35 250 20 300 20" stroke="url(#gradient-path)" strokeWidth="3" strokeDasharray="6 6" />
              <defs>
                <linearGradient id="gradient-path" x1="0" y1="20" x2="300" y2="20" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00BBC9" stopOpacity="0.3" />
                  <stop offset="0.5" stopColor="#00BBC9" />
                  <stop offset="1" stopColor="#00BBC9" stopOpacity="0.3" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Map Pin in the middle */}
            <div className="absolute left-[50%] -translate-x-[50%] -top-2 flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-[#00BBC9] border-2 border-white flex items-center justify-center shadow-lg relative animate-bounce">
                <div className="w-1.5 h-1.5 rounded-full bg-[#12231C]" />
              </div>
            </div>
          </div>

          <div className="flex flex-col mt-4">
            <span className="font-display text-[9px] font-black text-text-tertiary tracking-widest uppercase">
              DESTINO
            </span>
            <span className="font-display text-lg font-black text-white leading-tight mt-0.5">
              {destino}
            </span>
            <span className="font-body text-[10px] text-text-secondary leading-relaxed mt-1">
              {destinoDireccion}
            </span>
          </div>

          {/* Details metrics Grid */}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/10 pt-4.5 text-center">
            <div className="flex flex-col">
              <span className="font-display text-base font-black text-white">98 km</span>
              <span className="font-body text-[8px] font-black text-text-tertiary tracking-wider uppercase mt-0.5">RESTANTES</span>
            </div>
            <div className="flex flex-col border-l border-border/10">
              <span className="font-display text-base font-black text-white">1.4 hr</span>
              <span className="font-body text-[8px] font-black text-text-tertiary tracking-wider uppercase mt-0.5">TIEMPO</span>
            </div>
            <div className="flex flex-col border-l border-border/10">
              <span className="font-display text-base font-black text-white">10:42</span>
              <span className="font-body text-[8px] font-black text-text-tertiary tracking-wider uppercase mt-0.5">LLEGADA</span>
            </div>
          </div>
        </div>

        {/* Action buttons row */}
        <section className="mt-6 flex gap-3">
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-12 rounded-xl bg-[#28A745] hover:bg-[#218838] text-white font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            NAVEGAR EN MAPS
          </a>
          <a
            href={`tel:${contactoTelefono}`}
            className="flex-1 min-h-12 rounded-xl bg-transparent hover:bg-surface-elevated/20 border border-border/40 text-text-primary font-display text-xs font-black tracking-wide transition-all select-none text-center flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary shrink-0">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            CONTACTAR USUARIO
          </a>
        </section>

        {/* Quick Arrived Action Button */}
        <button
          type="button"
          onClick={handleLlegueDestino}
          disabled={procesando}
          className="w-full min-h-12 rounded-xl bg-[#00BBC9] hover:bg-[#00BBC9]/90 text-white font-display text-xs font-black tracking-wide transition-all cursor-pointer shadow-md select-none mt-3 flex items-center justify-center gap-1.5"
        >
          {procesando ? TEXTOS_CARGANDO.actualizando : "✓ MARCAR LLEGADA A DESTINO"}
        </button>

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

          {/* Expenses Card */}
          <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl p-4.5 flex gap-3 text-xs font-body leading-relaxed text-text-secondary">
            <span className="text-xl leading-none">💵</span>
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-text-primary text-[13px]">Gastos del viaje</span>
                <span className="border border-border/40 text-text-tertiary font-bold px-2 py-0.5 rounded-md text-[9px] hover:text-text-primary cursor-pointer select-none">
                  REGISTRAR
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5">Casetas, gasolina y viáticos autorizados para esta ruta.</p>

              <div className="mt-3.5 flex flex-col gap-2 border-t border-border/10 pt-3">
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Casetas (3)</span>
                  <span className="font-semibold text-text-primary">$186.00</span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Gasolina</span>
                  <span className="font-semibold text-text-primary">$0.00</span>
                </div>
                <div className="flex justify-between items-center border-t border-border/10 pt-2 text-text-secondary font-bold">
                  <span>Total registrado</span>
                  <span className="text-emerald-500 font-display text-sm font-black">$186.00</span>
                </div>
              </div>
            </div>
          </div>

          {/* Incidences Card */}
          <div className="bg-surface-elevated/25 border border-border/20 rounded-2xl p-4.5 flex gap-3 text-xs font-body leading-relaxed text-text-secondary">
            <span className="text-xl leading-none">⚠️</span>
            <div className="flex flex-col w-full">
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-text-primary text-[13px]">Incidencia</span>
                <span className="border border-amber-500/40 text-amber-500 font-extrabold px-2 py-0.5 rounded-md text-[9px]">
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

      </div>
    </div>
  );
}
