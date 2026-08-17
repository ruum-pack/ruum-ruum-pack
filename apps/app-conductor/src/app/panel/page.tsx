"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Aviso } from "@ruum/ui";
import { ConfirmarDisponibilidad } from "../ConfirmarDisponibilidad";
import { RegistroViajeActivo } from "../ViajeActivoContext";
import { EstadoRevisionConductor } from "./EstadoRevisionConductor";
import { usePanelData } from "./usePanelData";
import { registroViajeActivoDesdePasaporte } from "../active-trip-state";
import { useCerrarSesion } from "../../lib/use-cerrar-sesion";
import { CONTACTOS_SOPORTE_CONDUCTOR } from "../../lib/contactos-soporte";
import { folioViaje, destinoOperativo } from "./panel-utils";
import { getTripPresentation } from "../../lib/trip-presentation";
import { SincronizacionBadge } from "../../components/SincronizacionBadge";

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

const getPasoActualLabel = (estado: string) => {
  switch (estado) {
    case "conductor_asignado":
      return "Asignado - Pendiente";
    case "conductor_en_camino_al_origen":
      return "En camino al origen";
    case "conductor_en_punto_de_recoleccion":
    case "verificacion_vehiculo_en_proceso":
      return "En punto de recolección";
    case "evidencia_inicial_en_proceso":
    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
      return "Checklist de recolección";
    case "traslado_en_curso":
      return "Trayecto activo";
    case "llegada_a_destino":
      return "Llegada a destino";
    case "evidencia_final_en_proceso":
    case "evidencia_final_completada":
      return "Checklist de entrega";
    case "entrega_confirmada":
    case "servicio_cerrado":
      return "Servicio cerrado";
    default:
      return "Traslado activo";
  }
};

const getPasoActualDescription = (estado: string) => {
  switch (estado) {
    case "conductor_asignado":
      return "Espera a iniciar el traslado";
    case "conductor_en_camino_al_origen":
      return "Dirígete al punto de recolección";
    case "conductor_en_punto_de_recoleccion":
    case "verificacion_vehiculo_en_proceso":
      return "Confirma tu llegada en el punto de recolección";
    case "evidencia_inicial_en_proceso":
    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
      return "Registra la evidencia física del vehículo";
    case "traslado_en_curso":
      return "Conduce de manera segura hacia el destino";
    case "llegada_a_destino":
      return "Dirígete al punto de entrega y entrega las llaves";
    case "evidencia_final_en_proceso":
    case "evidencia_final_completada":
      return "Registra la evidencia física de la entrega";
    case "entrega_confirmada":
    case "servicio_cerrado":
      return "El traslado ha concluido con éxito";
    default:
      return "Completa las actividades pendientes";
  }
};

const getContinuarTrasladoHref = (viaje: any) => {
  if (viaje.estado === "evidencia_inicial_en_proceso" || viaje.estado === "evidencia_final_en_proceso") {
    return `/viajes/${viaje.traslado_id}/evidencia`;
  }
  return `/viajes/${viaje.traslado_id}`;
};

const IconPin = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function PaginaPanel() {
  const { cerrarSesion } = useCerrarSesion();
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
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsActivo(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      () => setGpsActivo(true),
      () => setGpsActivo(false),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);


  const {
    cargando,
    conductor,
    disponibilidad,
    disponibilidadPendiente,
    persistiendoDisponibilidad,
    enRevision,
    viajeActivoPrincipal,
    errorDisponibilidad,
    documentoBloqueante,
    seleccionarDisponibilidad,
    persistirDisponibilidad,
    setDisponibilidadPendiente,
    notificacionesCount = 0,
    gananciasHoy = 0,
    trasladosHoy = 0
  } = usePanelData() as any;

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

  const activeTripPresentation = viajeActivoPrincipal && viajeActivoPrincipal.estado
    ? getTripPresentation(viajeActivoPrincipal.estado)
    : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6 sm:py-10 flex flex-col justify-between min-h-[calc(100vh-100px)]">
      
      <RegistroViajeActivo
        viaje={viajeActivoPrincipal ? registroViajeActivoDesdePasaporte(viajeActivoPrincipal) : null}
      />

      {cargando ? (
        <PanelLoadingSkeleton />
      ) : (
        <div className="w-full flex flex-col flex-1 pb-20 md:pb-6">
          
          {/* Header / Saludo */}
          <header className="flex justify-between items-start">
            <div className="flex flex-col text-left">
              <span className="font-body text-sm font-medium text-text-tertiary">Hola,</span>
              <h1 className="font-display text-2xl font-black tracking-tight text-text-primary mt-1 uppercase">
                {conductor?.nombre ?? "—"}
              </h1>
              <p className="mt-1 font-body text-xs text-text-secondary">
                {conductor?.email && conductor?.telefono
                  ? `${conductor.email} • ${conductor.telefono}`
                  : conductor?.email || conductor?.telefono || ""}
              </p>
            </div>

            {/* Icono de Avisos con Badge '2' */}
            <div className="flex items-center mt-1 shrink-0">
              <Link 
                href="/notificaciones" 
                className="relative p-2.5 text-text-primary hover:text-[#00B4D8] transition-colors" 
                aria-label="Notificaciones"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-primary hover:text-[#00B4D8] transition-colors">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
                {notificacionesCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-danger text-white text-[9px] font-bold rounded-full h-4.5 w-4.5 flex items-center justify-center border border-[#070B14] shadow-xs">
                    {notificacionesCount}
                  </span>
                )}
              </Link>
            </div>
          </header>

          {/* Barra de Métricas del Día */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-[#0E1524] border border-border/15 rounded-2xl px-4 py-3.5 flex flex-col gap-0.5 shadow-xs">
              <span className="text-text-tertiary text-[9px] font-extrabold tracking-widest uppercase leading-none">Ganancias hoy</span>
              <span className="font-display text-xl font-black text-[#a8e820] mt-1.5 leading-none tabular-nums">
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(gananciasHoy)}
              </span>
              <span className="text-text-disabled text-[10px] mt-1">
                {trasladosHoy === 0 ? "Sin traslados cerrados" : `${trasladosHoy} traslado${trasladosHoy !== 1 ? "s" : ""} cerrado${trasladosHoy !== 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="bg-[#0E1524] border border-border/15 rounded-2xl px-4 py-3.5 flex flex-col gap-0.5 shadow-xs">
              <span className="text-text-tertiary text-[9px] font-extrabold tracking-widest uppercase leading-none">Traslados hoy</span>
              <span className="font-display text-xl font-black text-text-primary mt-1.5 leading-none tabular-nums">
                {trasladosHoy}
              </span>
              <span className="text-text-disabled text-[10px] mt-1">
                <Link href="/ganancias" className="text-[#00B4D8] hover:underline">Ver detalle →</Link>
              </span>
            </div>
          </div>

          {/* Estado Operativo */}
          <section className="mt-6 bg-[#0E1524] rounded-2xl p-5 border border-border/15 text-left shadow-xs">
            <div className="flex justify-between items-start">
              <div className="flex flex-col gap-1">
                <span className="text-text-tertiary text-[10px] font-extrabold tracking-wider uppercase">
                  Estado Operativo
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${esDisponible ? "bg-[#a8e820]" : "bg-text-disabled"}`} />
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
                disabled={disponibilidad === "en_viaje" || persistiendoDisponibilidad}
                className={`w-14 h-8 rounded-full transition-all duration-300 relative focus:outline-hidden ${
                  esDisponible ? "bg-[#a8e820] shadow-md shadow-[#a8e820]/25" : "bg-control-soft"
                } ${disponibilidad === "en_viaje" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                aria-label="Cambiar disponibilidad"
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

          {/* Tarjeta Dinámica de Traslado Activo o Disponibles */}
          <div className="mt-6">
            {viajeActivoPrincipal && activeTripPresentation ? (
              /* Tarjeta con Traslado Activo (Púrpura) */
              <div className="w-full p-5 rounded-3xl bg-[#090D1A] border border-purple-500/25 text-white flex flex-col gap-5 shadow-lg text-left">
                <div className="flex justify-between items-center w-full">
                  <span className="text-purple-400 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                    Traslado Activo
                  </span>
                  <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg px-2.5 py-1.5 flex flex-col items-center">
                    <span className="text-[8px] text-text-tertiary font-bold tracking-wider leading-none">FOLIO</span>
                    <span className="font-mono text-[10px] font-bold text-text-primary mt-1">
                      {folioViaje(viajeActivoPrincipal)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4 py-1 text-left relative pl-1">
                  {/* Origen */}
                  <div className="flex items-start gap-3.5 relative z-10">
                    <IconPin color="#ec4899" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-text-tertiary font-bold tracking-wider uppercase leading-none">Origen</span>
                      <span className="text-sm font-black text-text-primary mt-1">
                        {viajeActivoPrincipal.origen_ciudad || viajeActivoPrincipal.origen_direccion || "Punto de recolección"}
                      </span>
                    </div>
                  </div>
                  
                  {/* Línea punteada vertical entre origen y destino */}
                  <div className="absolute left-[9px] top-[24px] bottom-[24px] w-[1px] border-l border-dashed border-purple-500/30 z-0" />

                  {/* Destino */}
                  <div className="flex items-start gap-3.5 relative z-10">
                    <IconPin color="#3b82f6" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-text-tertiary font-bold tracking-wider uppercase leading-none">Destino</span>
                      <span className="text-sm font-black text-text-primary mt-1">
                        {viajeActivoPrincipal.destino_ciudad || viajeActivoPrincipal.destino_direccion || "Punto de entrega"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/10 pt-4 flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 shadow-xs">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-text-tertiary font-bold tracking-wider uppercase leading-none">Paso actual</span>
                    <div className="font-display text-sm font-black text-text-primary mt-1 leading-snug">
                      {getPasoActualLabel(viajeActivoPrincipal.estado)}
                    </div>
                    <span className="font-body text-[11px] text-text-secondary mt-0.5">
                      {getPasoActualDescription(viajeActivoPrincipal.estado)}
                    </span>
                  </div>
                </div>

                <Link
                  href={getContinuarTrasladoHref(viajeActivoPrincipal)}
                  className="w-full min-h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden mt-1"
                >
                  CONTINUAR TRASLADO →
                </Link>
              </div>
            ) : (
              /* Tarjeta sin Traslado Activo (Celeste/Azul) */
              <div className="w-full p-5 rounded-3xl bg-[#091E30]/40 border border-[#00B4D8]/25 text-white flex flex-col gap-4 shadow-lg text-left relative overflow-hidden">
                <div className="flex justify-between items-start w-full">
                  <div className="flex flex-col gap-1 max-w-[72%]">
                    <span className="text-[#00B4D8] text-[10px] font-extrabold uppercase tracking-widest leading-none">
                      Traslados Disponibles
                    </span>
                    <h2 className="font-display text-lg font-black tracking-tight text-text-primary leading-tight mt-2.5">
                      Hay nuevas oportunidades para ti
                    </h2>
                    <p className="font-body text-xs text-text-secondary mt-1.5 leading-normal">
                      Revisa los traslados disponibles según tu ubicación y preferencias.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#00B4D8]/10 border border-[#00B4D8]/20 flex items-center justify-center text-[#00B4D8] shrink-0 shadow-xs">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                    </svg>
                  </div>
                </div>
                
                <Link
                  href="/viajes"
                  className="w-full min-h-12 rounded-2xl bg-[#00B4D8] hover:bg-[#00B4D8]/80 text-[#070B14] font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus:outline-hidden mt-3"
                >
                  VER TRASLADOS →
                </Link>
              </div>
            )}
          </div>

          {/* Estado Operativo */}
          <section className="mt-6 bg-[#0E1524] rounded-2xl p-5 border border-border/15 text-left shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-border/10">
              <span className="text-text-tertiary text-[10px] font-extrabold tracking-wider uppercase">
                Estado Operativo
              </span>
              <Link href="/cuenta" className="text-xs font-semibold text-[#00B4D8] hover:underline flex items-center gap-0.5">
                Ver detalle <span className="text-[10px]">&gt;</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-4 mt-4 select-none">

              {/* GPS */}
              <div className="flex items-center gap-2.5">
                <svg
                  className={`w-4 h-4 shrink-0 ${
                    gpsActivo ? "text-[#a8e820]" : gpsActivo === false ? "text-danger" : "text-text-disabled"
                  }`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" strokeWidth="2" />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-bold text-text-primary">GPS</span>
                  <span className={`text-[10px] mt-1 ${
                    gpsActivo ? "text-[#a8e820]" : gpsActivo === false ? "text-danger" : "text-text-secondary"
                  }`}>
                    {gpsActivo ? "Activo" : gpsActivo === false ? "Inactivo" : "Verificando…"}
                  </span>
                </div>
              </div>

              {/* Conectividad */}
              <div className="flex items-center gap-2.5">
                <svg
                  className={`w-4 h-4 shrink-0 ${estaOnline ? "text-[#a8e820]" : "text-danger"}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <circle cx="12" cy="20" r="1" fill="currentColor" />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-bold text-text-primary">Conectividad</span>
                  <span className={`text-[10px] mt-1 ${estaOnline ? "text-[#a8e820]" : "text-danger"}`}>
                    {estaOnline ? "Conectado" : "Sin conexión"}
                  </span>
                </div>
              </div>

              {/* Documentos */}
              <div className="flex items-center gap-2.5">
                <svg
                  className={`w-4 h-4 shrink-0 ${!documentoBloqueante ? "text-[#a8e820]" : "text-danger"}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  {!documentoBloqueante ? (
                    <polyline points="20 6 9 17 4 12" strokeWidth="3" />
                  ) : (
                    <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                  )}
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-bold text-text-primary">Documentos</span>
                  <span className={`text-[10px] mt-1 ${!documentoBloqueante ? "text-[#a8e820]" : "text-danger"}`}>
                    {!documentoBloqueante ? "Vigentes" : "Pendientes"}
                  </span>
                </div>
              </div>

              {/* Vehículo */}
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#a8e820] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-bold text-text-primary">Vehículo</span>
                  <span className="text-[10px] text-[#a8e820] mt-1">Verificado</span>
                </div>
              </div>

            </div>
          </section>

          {/* Soporte y Emergencia */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <button
              type="button"
              onClick={() => setSoporteAbierto(true)}
              className="bg-[#0E1524] rounded-2xl p-4 border border-border/15 flex items-center gap-3.5 shadow-xs hover:border-[#00B4D8]/45 hover:bg-surface active:scale-95 transition-all duration-200 cursor-pointer text-left w-full"
            >
              <div className="w-10 h-10 rounded-full bg-[#00B4D8]/10 text-[#00B4D8] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 18 0" />
                  <rect x="2" y="12" width="4" height="6" rx="2" fill="none" />
                  <rect x="18" y="12" width="4" height="6" rx="2" fill="none" />
                  <path d="M20 15a4 4 0 0 1-4 4H12" />
                  <circle cx="11" cy="19" r="1" fill="currentColor" />
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-text-primary font-bold text-sm tracking-tight">Soporte</span>
                <span className="text-[10px] text-text-secondary mt-0.5">Estamos para ayudarte</span>
              </div>
            </button>

            <a
              href={CONTACTOS_SOPORTE_CONDUCTOR.emergencia.telefono.href}
              className="bg-[#0E1524] rounded-2xl p-4 border border-border/15 flex items-center gap-3.5 shadow-xs hover:border-danger/40 hover:bg-surface active:scale-95 transition-all duration-200 text-left w-full"
            >
              <div className="w-10 h-10 rounded-full bg-danger-soft text-danger flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-text-primary font-bold text-sm tracking-tight">Emergencia</span>
                <span className="text-[10px] text-text-secondary mt-0.5">Asistencia inmediata</span>
              </div>
            </a>
          </div>

        </div>
      )}

      {/* Bottom Sheet de Soporte */}
      {soporteAbierto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button 
            type="button" 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn cursor-default w-full h-full border-none outline-hidden" 
            onClick={() => setSoporteAbierto(false)}
            aria-label="Cerrar soporte"
          />
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
                href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.whatsapp.href}
                className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-colors"
              >
                <span className="text-xl">💬</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-emerald-400">WhatsApp de Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Mensajería instantánea y respuesta inmediata</span>
                </div>
              </a>
              <a
                href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.telefono.href}
                className="flex items-center gap-3 p-4 bg-route-soft border border-route-action/20 rounded-xl hover:bg-route-soft/60 transition-colors"
              >
                <span className="text-xl">📞</span>
                <div className="flex flex-col items-start">
                  <span className="font-display text-sm font-bold text-route-action">Llamar a Soporte</span>
                  <span className="font-body text-[11px] text-text-secondary">Habla por teléfono directamente con un operador</span>
                </div>
              </a>
              <a
                href={CONTACTOS_SOPORTE_CONDUCTOR.soporte.correo.href}
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
