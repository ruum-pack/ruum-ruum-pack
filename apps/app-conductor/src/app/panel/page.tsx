"use client";

import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { RegistroViajeActivo } from "../ViajeActivoContext";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { usePanelData } from "./usePanelData";
import { registroViajeActivoDesdePasaporte } from "../active-trip-state";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../lib/contactos-soporte";

function PanelLoadingSkeleton() {
  return (
    <output className="w-full flex flex-col gap-6" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
      <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-16 w-full animate-pulse rounded-full bg-slate-200" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
        <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
      </div>
    </output>
  );
}

export default function PaginaPanel() {
  const { cerrarSesion } = useCerrarSesion();
  const {
    cargando,
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    enRevision,
    viajeActivoPrincipal,
    errorDisponibilidad,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente,
    notificacionesCount = 0
  } = usePanelData() as any; // Cast as any to read optional properties dynamically if needed

  if (enRevision) {
    return (
      <EstadoRevisionConductor
        conductorId={enRevision.conductorId}
        solicitudId={enRevision.solicitudId}
        nombre={enRevision.nombre}
        documentosIniciales={enRevision.documentos}
        estadoExpediente={enRevision.estado}
        enviadoEn={enRevision.enviadoEn}
        onSalir={() => void cerrarSesion()}
      />
    );
  }

  const esDisponible = disponibilidad === "disponible";
  const alCambiarDisponibilidad = () => {
    if (disponibilidad === "en_viaje" || persistiendoDisponibilidad) return;
    const nuevoEstado = esDisponible ? "no_disponible" : "disponible";
    seleccionarDisponibilidad(nuevoEstado);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-[#06152B] to-[#0A2540] flex items-center justify-center p-0 md:p-6">
      <div className="w-full max-w-md min-h-screen md:min-h-[850px] bg-white text-[#0D2C54] px-6 py-8 flex flex-col justify-between shadow-2xl relative overflow-hidden md:rounded-[3rem] md:border-[12px] md:border-[#0F1E36]">
        
        <RegistroViajeActivo
          viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
        />

        {cargando ? (
          <PanelLoadingSkeleton />
        ) : (
          <div className="w-full flex flex-col flex-1">
            
            {/* Header / Saludo y Ajustes */}
            <header className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-lg font-medium text-[#4A5568] opacity-90">Hola</span>
                <h1 className="text-3xl font-extrabold text-[#0D2C54] tracking-tight mt-1 leading-none">
                  {conductor?.nombre ?? "Hector Lomelin"}
                </h1>
                <p className="text-sm font-semibold text-[#64748B] mt-2 font-mono">
                  {conductor?.email && conductor?.telefono 
                    ? `${conductor.email} - ${conductor.telefono}` 
                    : conductor?.email || conductor?.telefono || "correo-telefono"}
                </p>
              </div>

              {/* Iconos de Avisos y Cuenta */}
              <div className="flex items-center gap-3 mt-1 shrink-0">
                <Link 
                  href="/notificaciones" 
                  className="relative p-1.5 hover:scale-105 active:scale-95 transition-transform" 
                  aria-label="Notificaciones"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-[#0D2C54]">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                  </svg>
                  <span className="absolute -top-0.5 -right-0.5 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white shadow-xs">
                    {notificacionesCount > 0 ? notificacionesCount : 1}
                  </span>
                </Link>
                <Link 
                  href="/cuenta" 
                  className="p-1.5 hover:scale-105 active:scale-95 transition-transform" 
                  aria-label="Ajustes de cuenta"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-[#0D2C54]">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                </Link>
              </div>
            </header>

            {/* Disponibilidad */}
            <section className="flex justify-between items-center mt-8 bg-slate-50/60 rounded-2xl p-4 border border-slate-100/80">
              <span className="text-2xl font-bold text-[#0D2C54] tracking-tight">Disponible</span>
              <button
                type="button"
                onClick={alCambiarDisponibilidad}
                disabled={disponibilidad === "en_viaje" || persistiendoDisponibilidad}
                className={`w-16 h-9 rounded-full transition-all duration-300 relative focus:outline-hidden ${
                  esDisponible ? "bg-[#00B4D8] shadow-[0_2px_8px_rgba(0,180,216,0.4)]" : "bg-[#CBD5E1]"
                } ${disponibilidad === "en_viaje" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                aria-label="Cambiar disponibilidad"
              >
                <span
                  className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-md transition-all duration-300 ${
                    esDisponible ? "left-8" : "left-1"
                  }`}
                />
              </button>
            </section>

            {errorDisponibilidad && (
              <div className="mt-3">
                <Aviso tono="danger">{errorDisponibilidad}</Aviso>
              </div>
            )}

            {/* Botón de Traslado Activo */}
            <div className="mt-8">
              <Link
                href={viajeActivoPrincipal ? `/viajes/${viajeActivoPrincipal.traslado_id}` : "/viajes"}
                className="w-full min-h-16 rounded-[2rem] bg-gradient-to-r from-[#00C2FF] to-[#0052FF] text-white text-xl font-bold flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-center"
                style={{
                  boxShadow: "0 10px 25px -5px rgba(0, 180, 216, 0.4)"
                }}
              >
                Traslado activo
              </Link>
            </div>

            {/* Ilustración de Ondas Fluida (Cyan y Naranja/Rojo) */}
            <div className="relative w-full h-44 my-4 overflow-hidden select-none pointer-events-none">
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'radial-gradient(#0D2C54 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }} />
              <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 375 140" preserveAspectRatio="none" fill="none">
                {/* Cyan wave on left */}
                <path d="M-50,140 Q60,30 200,100 T440,70 L440,140 Z" fill="url(#cyanGrad)" />
                {/* Orange/Red wave on right */}
                <path d="M120,140 Q240,10 440,110 L440,140 Z" fill="url(#orangeGrad)" />
                <defs>
                  <linearGradient id="cyanGrad" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#0077B6" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="orangeGrad" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FF4D6D" stopOpacity="0.9" />
                    <stop offset="60%" stopColor="#FF9E00" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#FFB703" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Soporte y Emergencia */}
            <div className="grid grid-cols-2 gap-5 mt-2">
              <Link
                href="/cuenta/soporte"
                className="bg-white rounded-3xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] active:scale-95 transition-all duration-200"
              >
                <div className="w-16 h-16 rounded-full bg-[#EBF4FF] flex items-center justify-center mb-3 shadow-[0_4px_12px_rgba(59,130,246,0.1)]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0052FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 18 0" />
                    <rect x="2" y="12" width="4" height="6" rx="2" fill="none" />
                    <rect x="18" y="12" width="4" height="6" rx="2" fill="none" />
                    <path d="M20 15a4 4 0 0 1-4 4H12" />
                    <circle cx="11" cy="19" r="1" fill="#0052FF" />
                  </svg>
                </div>
                <span className="text-[#0D2C54] font-extrabold text-lg tracking-tight">Soporte</span>
              </Link>

              <a
                href={CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href}
                className="bg-white rounded-3xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] active:scale-95 transition-all duration-200"
              >
                <div className="w-16 h-16 rounded-full bg-[#FFEAE6] flex items-center justify-center mb-3 shadow-[0_4px_12px_rgba(239,68,68,0.15)]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 18V11a4 4 0 0 1 8 0v7" />
                    <rect x="5" y="18" width="14" height="3" rx="1" fill="none" />
                    <path d="M12 3v3" />
                    <path d="M5 6l2.5 2.5" />
                    <path d="M19 6l-2.5 2.5" />
                    <path d="M3 12h3" />
                    <path d="M18 12h3" />
                  </svg>
                </div>
                <span className="text-[#0D2C54] font-extrabold text-lg tracking-tight">Emergencia</span>
              </a>
            </div>

          </div>
        )}

        <ConfirmarDisponibilidad
          abierto={disponibilidadPendiente === "no_disponible"}
          persistiendo={persistiendoDisponibilidad}
          onCancelar={() => {
            if (!persistiendoDisponibilidad) setDisponibilidadPendiente(null);
          }}
          onConfirmar={() => void persistirDisponibilidad("no_disponible")}
        />
      </div>
    </div>
  );
}

