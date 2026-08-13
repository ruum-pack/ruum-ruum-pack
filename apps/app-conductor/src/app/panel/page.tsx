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
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)]">
      
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
              <span className="font-body text-sm font-medium text-text-tertiary">Hola</span>
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary mt-1 leading-none">
                {conductor?.nombre ?? "Hector Lomelin"}
              </h1>
              <p className="mt-2 font-body text-xs text-text-secondary">
                {conductor?.email && conductor?.telefono 
                  ? `${conductor.email} - ${conductor.telefono}` 
                  : conductor?.email || conductor?.telefono || "correo-telefono"}
              </p>
            </div>

            {/* Iconos de Avisos y Cuenta */}
            <div className="flex items-center gap-3 mt-1 shrink-0">
              <Link 
                href="/notificaciones" 
                className="relative p-1.5 text-text-primary hover:text-signal transition-colors" 
                aria-label="Notificaciones"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary hover:text-signal transition-colors">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[9px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center border border-surface shadow-xs">
                  {notificacionesCount > 0 ? notificacionesCount : 1}
                </span>
              </Link>
              <Link 
                href="/cuenta" 
                className="p-1.5 text-text-primary hover:text-signal transition-colors" 
                aria-label="Ajustes de cuenta"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-text-primary hover:text-signal transition-colors">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </Link>
            </div>
          </header>

          {/* Disponibilidad */}
          <section className="flex justify-between items-center mt-8 bg-surface-elevated/40 rounded-2xl p-4 border border-border/20">
            <span className="font-display text-lg font-bold text-text-primary">Disponible</span>
            <button
              type="button"
              onClick={alCambiarDisponibilidad}
              disabled={disponibilidad === "en_viaje" || persistiendoDisponibilidad}
              className={`w-14 h-8 rounded-full transition-all duration-300 relative focus:outline-hidden ${
                esDisponible ? "bg-emerald-500 shadow-md shadow-emerald-500/20" : "bg-control-soft"
              } ${disponibilidad === "en_viaje" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              aria-label="Cambiar disponibilidad"
            >
              <span
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-xs transition-all duration-300 ${
                  esDisponible ? "left-7" : "left-1"
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
              className="w-full min-h-12 rounded-xl bg-signal text-slate-950 font-display text-base font-extrabold flex items-center justify-center shadow-md hover:bg-signal-hover active:scale-[0.98] transition-all text-center"
            >
              Traslado activo
            </Link>
          </div>

          {/* Ilustración de Ondas Fluida (adaptada a tema oscuro/claro con variables CSS) */}
          <div className="relative w-full h-44 my-4 overflow-hidden select-none pointer-events-none">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'radial-gradient(var(--ruum-text) 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }} />
            <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 375 140" preserveAspectRatio="none" fill="none">
              {/* Cyan wave on left */}
              <path d="M-50,140 Q60,30 200,100 T440,70 L440,140 Z" fill="url(#cyanGrad)" />
              {/* Lime/Green wave on right */}
              <path d="M120,140 Q240,10 440,110 L440,140 Z" fill="url(#limeGrad)" />
              <defs>
                <linearGradient id="cyanGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--color-route, #3aa5ff)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--color-route, #3aa5ff)" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="limeGrad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--color-signal, #a8e820)" stopOpacity="0.25" />
                  <stop offset="60%" stopColor="var(--color-signal, #a8e820)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--color-signal, #a8e820)" stopOpacity="0.02" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Soporte y Emergencia */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Link
              href="/cuenta/soporte"
              className="bg-surface-elevated rounded-2xl p-5 border border-border/40 flex flex-col items-center justify-center text-center shadow-xs hover:border-signal/40 hover:bg-surface active:scale-95 transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-full bg-route-soft text-route-action flex items-center justify-center mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 18 0" />
                  <rect x="2" y="12" width="4" height="6" rx="2" fill="none" />
                  <rect x="18" y="12" width="4" height="6" rx="2" fill="none" />
                  <path d="M20 15a4 4 0 0 1-4 4H12" />
                  <circle cx="11" cy="19" r="1" fill="currentColor" />
                </svg>
              </div>
              <span className="text-text-primary font-bold text-base tracking-tight">Soporte</span>
            </Link>

            <a
              href={CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href}
              className="bg-surface-elevated rounded-2xl p-5 border border-border/40 flex flex-col items-center justify-center text-center shadow-xs hover:border-danger/40 hover:bg-surface active:scale-95 transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 18V11a4 4 0 0 1 8 0v7" />
                  <rect x="5" y="18" width="14" height="3" rx="1" fill="none" />
                  <path d="M12 3v3" />
                  <path d="M5 6l2.5 2.5" />
                  <path d="M19 6l-2.5 2.5" />
                  <path d="M3 12h3" />
                  <path d="M18 12h3" />
                </svg>
              </div>
              <span className="text-text-primary font-bold text-base tracking-tight">Emergencia</span>
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
  );
}

