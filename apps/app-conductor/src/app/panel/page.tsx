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
    <output className="w-full flex flex-col gap-5" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 animate-pulse rounded bg-surface-elevated" />
          <div className="h-4 w-28 animate-pulse rounded bg-surface-elevated" />
        </div>
        <div className="flex gap-1">
          <div className="h-11 w-11 animate-pulse rounded-full bg-surface-elevated" />
          <div className="h-11 w-11 animate-pulse rounded-full bg-surface-elevated" />
          <div className="h-11 w-11 animate-pulse rounded-full bg-surface-elevated" />
        </div>
      </div>
      {/* Skeleton estado conductor — misma altura que card real */}
      <div className="h-[118px] w-full animate-pulse rounded-2xl bg-surface-elevated" />
      {/* Skeleton card principal — 148px active trip */}
      <div className="h-[148px] w-full animate-pulse rounded-3xl bg-surface-elevated" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[88px] animate-pulse rounded-2xl bg-surface-elevated" />
        <div className="h-[88px] animate-pulse rounded-2xl bg-surface-elevated" />
      </div>
      <div className="h-[142px] w-full animate-pulse rounded-2xl bg-surface-elevated" />
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
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] lg:max-w-5xl lg:grid lg:grid-cols-[1.25fr_0.85fr] lg:gap-8 lg:items-start">
      <RegistroViajeActivo
        viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
      />
      {/* Barra fina de refresco — no gira el icono, evita confusión */}
      {refrescando && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-1 bg-signal/20" aria-hidden>
          <div className="h-full w-1/3 animate-pulse bg-signal" style={{ animationDuration: "0.9s" }} />
        </div>
      )}

      {cargando ? (
        <div className="lg:col-span-2">
          <PanelLoadingSkeleton />
        </div>
      ) : (
        <div className="w-full flex flex-col flex-1 pb-20 md:pb-6 lg:col-span-2">
          {/* Header — Brand Book: logo horizontal + descriptor */}
          <header className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <LogoMarca tamano={28} color="signal" descriptor="Traslado vehicular con conductores certificados" mostrarDescriptor={false} mostrarRespaldo={false} />
              <span className="hidden sm:inline font-body text-[10px] font-semibold uppercase tracking-wider text-text-tertiary whitespace-nowrap">by MoviliaX</span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Botón de Ayuda / Soporte */}
              <button
                type="button"
                onClick={() => setSoporteAbierto(true)}
                aria-label="Ayuda y soporte operativo"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-signal rounded-full hover:bg-surface-elevated transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action cursor-pointer"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </button>

              {/* Icono de Notificaciones con Badge — 99+ y área 44px */}
              <Link
                href="/notificaciones"
                className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-primary hover:text-route-action transition-colors rounded-full hover:bg-surface-elevated focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                aria-label={notificacionesCount > 0 ? `Notificaciones (${notificacionesCount > 99 ? "99+" : notificacionesCount} sin leer)` : "Notificaciones"}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
                {notificacionesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[11px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center border-2 border-surface shadow-xs tabular-nums">
                    {notificacionesCount > 99 ? "99+" : notificacionesCount}
                  </span>
                )}
              </Link>

              {/* Botón de Recarga sutil — secundario, no compite */}
              <button
                type="button"
                onClick={() => void recargar()}
                disabled={refrescando}
                aria-label="Actualizar información operativa"
                aria-busy={refrescando || undefined}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-elevated transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={refrescando ? "opacity-60" : ""}>
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
              </button>

              {/* Botón de Cerrar Sesión — discreto, evita tap accidental */}
              <button
                type="button"
                onClick={() => void cerrarSesion()}
                disabled={cerrandoSesion}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-tertiary hover:text-red-400 rounded-full hover:bg-red-500/10 transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action cursor-pointer disabled:opacity-50"
              >
                {cerrandoSesion ? (
                  <span className="text-xs font-bold text-red-400 animate-pulse" aria-live="polite">...</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Aviso Modo Offline — sticky para no perderlo al hacer scroll */}
          {!estaOnline && (
            <div className="sticky top-2 z-20 mt-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warn-soft px-4 py-3 shadow-sm">
                <p className="font-body text-sm leading-5 text-warning">
                  <span className="font-bold">Sin conexión:</span> Ves datos guardados. Los cambios se sincronizarán al volver la red.
                </p>
                <button
                  type="button"
                  onClick={() => void recargar()}
                  className="shrink-0 inline-flex min-h-11 items-center rounded-lg border border-warning/30 bg-surface px-3 py-2 font-body text-xs font-bold text-warning hover:bg-surface-elevated focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-warning"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* ESTADO DEL CONDUCTOR — switch accesible */}
          <section className="mt-5 bg-surface rounded-2xl p-5 border border-border/40 text-left shadow-sm" aria-labelledby="titulo-estado-conductor">
            <div className="flex justify-between items-start gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <span id="titulo-estado-conductor" className="text-text-tertiary text-xs font-extrabold tracking-wider uppercase">
                  Estado del Conductor
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${esDisponible ? "bg-signal animate-pulse" : "bg-text-disabled"}`} aria-hidden />
                  <span className="font-display text-lg font-black text-text-primary uppercase tracking-wide">
                    {disponibilidad === "en_viaje" ? "En viaje" : esDisponible ? "Disponible" : "No Disponible"}
                  </span>
                </div>
                <p className="font-body text-xs text-text-secondary mt-1">
                  {disponibilidad === "en_viaje"
                    ? "Traslado activo — disponibilidad bloqueada"
                    : esDisponible
                      ? "Recibiendo solicitudes · Te avisaremos con sonido"
                      : "No recibirás traslados hasta activarte"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={esDisponible}
                aria-labelledby="titulo-estado-conductor"
                aria-label={esDisponible ? "Disponible: recibir traslados" : "No disponible: pausar traslados"}
                onClick={alCambiarDisponibilidad}
                disabled={disponibilidad === "en_viaje" || persistiendoDisponibilidad || !estaOnline}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 p-1 transition-all duration-300 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action disabled:cursor-not-allowed disabled:opacity-50 ${
                  esDisponible
                    ? "bg-signal border-signal shadow-md shadow-signal/20"
                    : "bg-surface-elevated border-border"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                    esDisponible ? "translate-x-7" : "translate-x-0"
                  }`}
                  aria-hidden
                />
              </button>
            </div>
            {disponibilidad === "en_viaje" && (
              <p className="mt-3 rounded-lg border border-route-action/20 bg-route-soft px-3 py-2 font-body text-xs font-semibold text-route-action">
                🔒 En viaje activo — termina el traslado para cambiar disponibilidad.
              </p>
            )}
            {persistiendoDisponibilidad && (
              <p className="mt-2 font-body text-xs text-text-tertiary" aria-live="polite">Actualizando estado…</p>
            )}
          </section>

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

      {/* Sheet de Soporte — antes nunca se renderizaba */}
      <PanelSupportSheet abierto={soporteAbierto} onCerrar={() => setSoporteAbierto(false)} />

      {/* Toasts no intrusivos — no empujan layout */}
      {(errorCerrarSesion || errorDisponibilidad) && (
        <div className="pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:max-w-sm">
          {errorCerrarSesion && (
            <div className="pointer-events-auto" role="alert">
              <Aviso tono="danger">{errorCerrarSesion}</Aviso>
            </div>
          )}
          {errorDisponibilidad && (
            <div className="pointer-events-auto" role="alert">
              <Aviso tono="danger">{errorDisponibilidad}</Aviso>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
