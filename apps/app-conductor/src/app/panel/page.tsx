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
import { getBatteryState, intervaloTrackingMs } from "../../lib/battery";

function PanelLoadingSkeleton() {
  return (
    <output className="w-full flex flex-col gap-5 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-6" aria-label="Cargando panel operativo" aria-busy="true">
      <div className="hidden lg:contents" aria-hidden>
        <div className="h-7 w-full" />
        <div className="h-7 w-full" />
      </div>
      <div className="flex justify-between items-center lg:col-span-2">
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
      {/* Izq: estado + card principal */}
      <div className="flex flex-col gap-5">
        <div className="h-[118px] w-full animate-pulse rounded-2xl bg-surface-elevated" />
        <div className="h-[148px] w-full animate-pulse rounded-3xl bg-surface-elevated" />
      </div>
      {/* Der: salud colapsada + metrics con sparkline/ring */}
      <div className="flex flex-col gap-5">
        <div className="h-[86px] w-full animate-pulse rounded-2xl bg-surface-elevated" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-[110px] animate-pulse rounded-2xl bg-surface-elevated" />
          <div className="h-[110px] animate-pulse rounded-2xl bg-surface-elevated" />
        </div>
      </div>
    </output>
  );
}

export default function PaginaPanel() {
  const { cerrarSesion, cerrandoSesion, errorCerrarSesion } = useCerrarSesion();
  const [soporteAbierto, setSoporteAbierto] = useState(false);
  const [gpsActivo, setGpsActivo] = useState<boolean | null>(null);
  const [gpsUltimaSenal, setGpsUltimaSenal] = useState<Date | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const [estaOnline, setEstaOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [verMasAbierto, setVerMasAbierto] = useState(false);

  useEffect(() => {
    const actualizar = () => setEstaOnline(navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  const {
    cargando,
    refrescando,
    ultimaActualizacion,
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

  const esDisponible = disponibilidad === "disponible";
  const alCambiarDisponibilidad = () => {
    if (disponibilidad === "en_viaje" || persistiendoDisponibilidad) return;
    const nuevoEstado = esDisponible ? "no_disponible" : "disponible";
    if (navigator.vibrate) navigator.vibrate(12);
    seleccionarDisponibilidad(nuevoEstado);
  };

  // Pull-to-refresh nativo simple (solo en móvil, desde el top)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let startY = 0;
    let pulling = false;
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      } else {
        pulling = false;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pulling || document.body.classList.contains("conductor-tiene-viaje-activo")) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 0 && diff < 96) {
        setPullOffset(diff * 0.5);
      }
    };
    const onTouchEnd = () => {
      if (pullOffset > 48 && !refrescando) {
        void recargar();
        if (navigator.vibrate) navigator.vibrate(20);
      }
      setPullOffset(0);
      pulling = false;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullOffset, refrescando, recargar]);

  useEffect(() => {
    // Tracking nativo con intervalo adaptado a disponibilidad + batería (OFF-002)
    if (soportaTrackingNativo()) {
      let cancelado = false;
      let interval: number | undefined;
      const iniciar = async () => {
        const battery = await getBatteryState();
        const intervaloMs = intervaloTrackingMs({ disponible: disponibilidad === "disponible", enViaje: Boolean(viajeActivoPrincipal), battery });
        const verificarTracking = async () => {
          try {
            const status = await obtenerEstadoTrackingNativo();
            const activo = Boolean(status.active && !status.lastError);
            if (!cancelado) {
              setGpsActivo(activo);
              if (activo) setGpsUltimaSenal(new Date());
            }
          } catch {
            if (!cancelado) setGpsActivo(false);
          }
        };
        void verificarTracking();
        interval = window.setInterval(verificarTracking, intervaloMs);
      };
      void iniciar();
      return () => {
        cancelado = true;
        if (interval !== undefined) window.clearInterval(interval);
      };
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsActivo(false);
      return;
    }
    const altaPrecision = disponibilidad === "disponible" || Boolean(viajeActivoPrincipal);
    const id = navigator.geolocation.watchPosition(
      () => {
        setGpsActivo(true);
        setGpsUltimaSenal(new Date());
      },
      () => setGpsActivo(false),
      {
        enableHighAccuracy: altaPrecision,
        maximumAge: altaPrecision ? 30_000 : 60_000,
        timeout: altaPrecision ? 15_000 : 10_000
      }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [disponibilidad, viajeActivoPrincipal]);

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

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)] lg:max-w-5xl">
      <RegistroViajeActivo
        viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
      />
      {/* Indicador pull-to-refresh */}
      {pullOffset > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-surface-elevated border border-border shadow-md px-3 py-1.5 flex items-center gap-2" aria-hidden>
          <span className={`size-2 rounded-full ${pullOffset > 48 ? "bg-signal" : "bg-text-tertiary"}`} />
          <span className="font-body text-xs font-bold text-text-secondary">{pullOffset > 48 ? "Suelta para actualizar" : "Desliza para actualizar"}</span>
        </div>
      )}
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
              <LogoMarca tamano={28} color="signal" descriptor="Conductor" mostrarDescriptor={true} mostrarRespaldo={false} />
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
                  className="shrink-0 inline-flex min-h-11 items-center rounded-lg border border-warning/30 bg-surface px-3 py-2 font-body text-sm font-bold text-warning hover:bg-surface-elevated focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-warning"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* === REORDEN P1: Mobile 1 Activo sticky → 2 Estado → 3 Salud colapsada → 4 Métricas === */}
          {/* Desktop: grid 1.2fr operativa (izq) / 0.8fr analítica (der) */}
          <div className="mt-5 flex flex-col gap-6 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-6 lg:items-start">
            {/* COL IZQ — Operativa */}
            <div className="flex flex-col gap-6 order-1">
              {/* 1 — Traslado activo sticky top (solo si existe) */}
              {viajeActivoPrincipal && (
                <div className="sticky top-2 z-10 -mx-1 px-1">
                  <PanelActiveTripCard viaje={viajeActivoPrincipal} />
                </div>
              )}

              {/* 2 — Estado del conductor */}
              <section className="bg-surface rounded-2xl p-5 border border-border/40 text-left shadow-sm" aria-labelledby="titulo-estado-conductor">
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

              {/* Oportunidades — ocupa el slot de Activo cuando no hay viaje */}
              {!viajeActivoPrincipal && (
                <PanelOpportunitiesCard
                  disponibilidad={disponibilidad}
                  viajesDisponibles={viajesDisponibles}
                  gananciasHoy={gananciasHoy}
                  trasladosHoy={trasladosHoy}
                  ultimaActualizacion={ultimaActualizacion}
                  refrescando={refrescando}
                  onRecargar={() => void recargar()}
                  onActivar={() => seleccionarDisponibilidad("disponible")}
                />
              )}
            </div>

            {/* COL DER — Analítica */}
            <div className="flex flex-col gap-6 order-2">
              {viajeActivoPrincipal ? (
                <>
                  {/* Con viaje activo: métricas y salud detrás de Ver más — reduce scroll 35% */}
                  <button
                    type="button"
                    onClick={() => setVerMasAbierto((v) => !v)}
                    aria-expanded={verMasAbierto}
                    className="w-full flex items-center justify-between rounded-2xl border border-border/30 bg-surface-elevated px-4 py-3.5 text-left shadow-xs hover:bg-surface focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action"
                  >
                    <span className="flex flex-col">
                      <span className="font-display text-sm font-bold text-text-primary">Métricas y salud</span>
                      <span className="font-body text-xs text-text-secondary">
                        {verMasAbierto ? "Ocultar detalles" : `${trasladosHoy} traslados hoy · ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(gananciasHoy)}`}
                      </span>
                    </span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={`text-text-tertiary transition-transform ${verMasAbierto ? "rotate-180" : ""}`} aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {verMasAbierto && (
                    <div className="flex flex-col gap-6 animate-fadeIn">
                      <PanelMetrics gananciasHoy={gananciasHoy} trasladosHoy={trasladosHoy} />
                      <PanelOperationalHealth
                        gpsActivo={gpsActivo}
                        gpsUltimaSenal={gpsUltimaSenal}
                        estaOnline={estaOnline}
                        documentoBloqueante={documentoBloqueante}
                        documentoPorVencer={documentoPorVencer}
                        conductorEstado={conductor?.estado}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Sin viaje: Salud (colapsada por defecto) → Métricas */}
                  <PanelOperationalHealth
                    gpsActivo={gpsActivo}
                    gpsUltimaSenal={gpsUltimaSenal}
                    estaOnline={estaOnline}
                    documentoBloqueante={documentoBloqueante}
                    documentoPorVencer={documentoPorVencer}
                    conductorEstado={conductor?.estado}
                  />
                  <PanelMetrics gananciasHoy={gananciasHoy} trasladosHoy={trasladosHoy} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB Ver mapa — solo mobile, sin viaje activo y disponible */}
      {!viajeActivoPrincipal && esDisponible && !cargando && (
        <Link
          href="/viajes"
          aria-label={`Ver mapa de oportunidades${viajesDisponibles.length > 0 ? `, ${viajesDisponibles.length} traslados disponibles` : ""}`}
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3.5 font-display text-sm font-black text-slate-950 shadow-lg shadow-signal/20 hover:bg-signal/90 active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Ver mapa
          {viajesDisponibles.length > 0 && (
            <span className="ml-1 rounded-full bg-slate-950 text-signal px-2 py-0.5 text-xs font-black tabular-nums">
              {viajesDisponibles.length}
            </span>
          )}
        </Link>
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
