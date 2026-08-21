"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Aviso, LogoMarca } from "@ruum/ui";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { RegistroViajeActivo } from "../ViajeActivoContext";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { usePanelData } from "./usePanelData";
import { registroViajeActivoDesdePasaporte } from "../active-trip-state";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../lib/contactos-soporte";
import { PanelActiveTripCard } from "./PanelActiveTripCard";
import { PanelOpportunitiesCard } from "./PanelOpportunitiesCard";
import { PanelMetrics } from "./PanelMetrics";
import { PanelOperationalHealth } from "./PanelOperationalHealth";
import { PanelSupportSheet } from "./PanelSupportSheet";
import { soportaTrackingNativo, obtenerEstadoTrackingNativo } from "../../lib/background-tracking";

function PanelLoadingSkeleton() {
  return (
    <output className="w-full flex flex-col gap-6" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-12 animate-pulse rounded bg-surface-elevated" />
          <div className="h-8 w-44 animate-pulse rounded bg-surface-elevated" />
          <div className="h-4 w-32 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-elevated" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-2xl bg-surface-elevated" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface-elevated" />
      </div>
      <div className="h-16 w-full animate-pulse rounded-full bg-surface-elevated" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-surface-elevated" />
      <div className="h-24 w-full animate-pulse rounded-2xl bg-surface-elevated" />
    </output>
  );
}

export default function PaginaPanel() {
  const { cerrarSesion, cerrandoSesion, errorCerrarSesion } = useCerrarSesion();
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const [gpsActivo, setGpsActivo] = useState<boolean | null>(null);
  const [estaOnline, setEstaOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const actualizar = () => setEstaOnline(navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  useEffect(() => {
    // Si soporta tracking nativo en Android, consultar el plugin
    if (soportaTrackingNativo()) {
      let cancelado = false;
      const verificarTracking = async () => {
        try {
          const status = await obtenerEstadoTrackingNativo();
          if (!cancelado) setGpsActivo(status.active && !status.lastError);
        } catch {
          if (!cancelado) setGpsActivo(false);
        }
      };
      void verificarTracking();
      const interval = setInterval(verificarTracking, 20_000);
      return () => {
        cancelado = true;
        clearInterval(interval);
      };
    }

    // Navegador Web: usar Geolocation API estándar
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsActivo(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      () => setGpsActivo(true),
      () => setGpsActivo(false),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const {
    cargando,
    refrescando,
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    enRevision,
    viajeActivoPrincipal,
    viajesDisponibles,
    errorDisponibilidad,
    documentoBloqueante,
    documentoPorVencer,
    notificacionesCount = 0,
    gananciasHoy = 0,
    trasladosHoy = 0,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente,
    recargar
  } = usePanelData();

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
        <div className="w-full flex flex-col flex-1 pb-20 md:pb-6">
          {/* Header — Brand Book: logo horizontal + descriptor */}
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <LogoMarca tamano={28} color="signal" descriptor="Traslado vehicular con conductores certificados" mostrarDescriptor={false} mostrarRespaldo={false} />
              <span className="hidden sm:inline font-body text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">by MoviliaX</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Botón de Ayuda / Soporte */}
              <button
                type="button"
                onClick={() => setSoporteAbierto(true)}
                aria-label="Ayuda y soporte operativo"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-signal rounded-full hover:bg-surface-elevated transition-all cursor-pointer"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>

              {/* Botón de Recarga / Refresco Manual */}
              <button
                type="button"
                onClick={() => void recargar()}
                disabled={refrescando}
                aria-label="Actualizar información operativa"
                className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-elevated transition-all cursor-pointer ${
                  refrescando ? "animate-spin text-route-action" : ""
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>

              {/* Icono de Notificaciones con Badge */}
              <Link
                href="/notificaciones"
                className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-primary hover:text-route-action transition-colors rounded-full hover:bg-surface-elevated"
                aria-label={notificacionesCount > 0 ? `Notificaciones (${notificacionesCount} sin leer)` : "Notificaciones"}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
                {notificacionesCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-danger text-white text-[9px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center border border-surface shadow-xs">
                    {notificacionesCount}
                  </span>
                )}
              </Link>

              {/* Botón de Cerrar Sesión */}
              <button
                type="button"
                onClick={() => void cerrarSesion()}
                disabled={cerrandoSesion}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-red-400 rounded-full hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-50"
              >
                {cerrandoSesion ? (
                  <span className="text-xs font-bold text-red-400 animate-pulse">...</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Error al cerrar sesión si ocurre */}
          {errorCerrarSesion && (
            <div className="mt-4">
              <Aviso tono="danger">{errorCerrarSesion}</Aviso>
            </div>
          )}

          {/* Aviso Modo Offline si se pierde la conexión */}
          {!estaOnline && (
            <div className="mt-4">
              <Aviso tono="atencion">
                <span className="font-bold">Modo sin conexión:</span> Mostrando datos guardados localmente. Los cambios de disponibilidad se sincronizarán al recuperar la red.
              </Aviso>
            </div>
          )}

          {/* ESTADO DEL CONDUCTOR — amarillo ruta solo acento 10% */}
          <section className="mt-5 bg-surface rounded-2xl p-5 border border-border/40 text-left shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-text-tertiary text-xs font-extrabold tracking-wider uppercase">
                  Estado del Conductor
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${esDisponible ? "bg-signal" : "bg-text-disabled"}`} />
                  <span className="font-display text-lg font-black text-text-primary uppercase tracking-wide">
                    {esDisponible ? "Disponible" : "No Disponible"}
                  </span>
                </div>
                <p className="font-body text-xs text-text-secondary mt-1">
                  {esDisponible ? "Recibiendo solicitudes de traslados" : "No recibiendo solicitudes de traslados"}
                </p>
              </div>
              <button
                type="button"
                onClick={alCambiarDisponibilidad}
                disabled={disponibilidad === "en_viaje" || persistiendoDisponibilidad || !estaOnline}
                className={`w-14 h-8 rounded-full transition-all duration-300 relative focus:outline-hidden ${
                  esDisponible ? "bg-signal shadow-md shadow-signal/25" : "bg-surface"
                } ${disponibilidad === "en_viaje" || !estaOnline ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                aria-label="Cambiar disponibilidad operativa"
              >
                <span
                  className={`absolute top-1.5 w-5 h-5 rounded-full bg-white shadow-xs transition-all duration-300 ${
                    esDisponible ? "left-7" : "left-1.5"
                  }`}
                />
              </button>
            </div>
          </section>

          {errorDisponibilidad && (
            <div className="mt-3">
              <Aviso tono="danger">{errorDisponibilidad}</Aviso>
            </div>
          )}

          {/* Tarjeta Dinámica de Traslado Activo o Oportunidades Disponibles */}
          <div className="mt-6">
            {viajeActivoPrincipal ? (
              <PanelActiveTripCard viaje={viajeActivoPrincipal} />
            ) : (
              <PanelOpportunitiesCard
                disponibilidad={disponibilidad}
                viajesDisponibles={viajesDisponibles}
              />
            )}
          </div>

          {/* GANANCIAS DEL DÍA */}
          <PanelMetrics gananciasHoy={gananciasHoy} trasladosHoy={trasladosHoy} />

          {/* SALUD OPERACIONAL */}
          <PanelOperationalHealth
            gpsActivo={gpsActivo}
            estaOnline={estaOnline}
            documentoBloqueante={documentoBloqueante}
            documentoPorVencer={documentoPorVencer}
            conductorEstado={conductor?.estado}
          />
        </div>
      )}

      {/* Modal de Confirmación de Disponibilidad */}
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
