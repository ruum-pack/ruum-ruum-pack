"use client";

import Link from "next/link";
import { getTripPresentation } from "../../lib/trip-presentation";
import { createNavigationOptions, type NavigationOption } from "../../lib/navigation-launcher";
import { folioViaje, nombreVehiculo, puntoActual, type PasaporteRow } from "./panel-utils";

interface PanelActiveTripCardProps {
  viaje: PasaporteRow;
}

export const getPasoActualLabel = (estado: string) => {
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

export const getPasoActualDescription = (estado: string) => {
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

export const getContinuarTrasladoHref = (viaje: PasaporteRow) => {
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

export function PanelActiveTripCard({ viaje }: PanelActiveTripCardProps) {
  if (!viaje.estado) return null;

  const presentation = getTripPresentation(viaje.estado);
  const punto = puntoActual(viaje, presentation.primaryAction.action);
  const navigationOptions: NavigationOption[] = (punto.lat !== null && punto.lng !== null) || (viaje.destino_direccion || viaje.origen_direccion)
    ? createNavigationOptions({
        lat: punto.lat,
        lng: punto.lng,
        address: viaje.destino_direccion || viaje.origen_direccion || ""
      })
    : [];

  const autoNombre = nombreVehiculo(viaje);
  const placas = viaje.vehiculo_placas;
  const colorAuto = viaje.vehiculo_color;

  return (
    <div className="w-full p-5 rounded-3xl bg-surface-elevated border border-purple-500/30 text-text-primary flex flex-col gap-4 shadow-lg text-left relative">
      {/* Header Traslado Activo & Folio */}
      <div className="flex justify-between items-center w-full">
        <span className="text-purple-400 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          Traslado Activo
        </span>
        <div className="border border-purple-500/25 bg-purple-500/10 rounded-lg px-2.5 py-1 flex flex-col items-center">
          <span className="text-[8px] text-text-tertiary font-bold tracking-wider leading-none">FOLIO</span>
          <span className="font-mono text-[10px] font-bold text-text-primary mt-0.5">
            {folioViaje(viaje)}
          </span>
        </div>
      </div>

      {/* Datos del Vehículo */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface rounded-xl border border-border/20">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🚗</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-text-primary leading-tight">{autoNombre}</span>
            <span className="text-[10px] text-text-tertiary">
              {colorAuto ? `Color: ${colorAuto}` : "Vehículo asignado"}
            </span>
          </div>
        </div>
        {placas && (
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-surface-elevated border border-border/40 text-text-primary">
            {placas}
          </span>
        )}
      </div>

      {/* Ruta Origen y Destino */}
      <div className="flex flex-col gap-3 py-1 text-left relative pl-1">
        {/* Origen */}
        <div className="flex items-start gap-3.5 relative z-10">
          <IconPin color="#ec4899" />
          <div className="flex flex-col">
            <span className="text-[9px] text-text-tertiary font-bold tracking-wider uppercase leading-none">Origen</span>
            <span className="text-sm font-black text-text-primary mt-1">
              {viaje.origen_ciudad || viaje.origen_direccion || "Punto de recolección"}
            </span>
          </div>
        </div>

        {/* Línea punteada vertical entre origen y destino */}
        <div className="absolute left-[9px] top-[22px] bottom-[22px] w-[1px] border-l border-dashed border-purple-500/30 z-0" />

        {/* Destino */}
        <div className="flex items-start gap-3.5 relative z-10">
          <IconPin color="#3b82f6" />
          <div className="flex flex-col">
            <span className="text-[9px] text-text-tertiary font-bold tracking-wider uppercase leading-none">Destino</span>
            <span className="text-sm font-black text-text-primary mt-1">
              {viaje.destino_ciudad || viaje.destino_direccion || "Punto de entrega"}
            </span>
          </div>
        </div>
      </div>

      {/* Paso Actual */}
      <div className="border-t border-border/15 pt-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] text-text-tertiary font-bold tracking-wider uppercase leading-none">Paso actual</span>
          <div className="font-display text-sm font-black text-text-primary mt-0.5 leading-snug">
            {getPasoActualLabel(viaje.estado)}
          </div>
          <span className="font-body text-[11px] text-text-secondary">
            {getPasoActualDescription(viaje.estado)}
          </span>
        </div>
      </div>

      {/* Navegación rápida (1-tap) a Maps/Waze si hay destino */}
      {navigationOptions.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider shrink-0">
            Navegar:
          </span>
          <div className="flex gap-2 flex-1">
            {navigationOptions.slice(0, 2).map((opt) => (
              <a
                key={opt.id}
                href={opt.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[40px] py-1.5 px-3 rounded-xl bg-surface hover:bg-surface-elevated border border-border/30 text-text-primary text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors text-center"
              >
                <span>{opt.id === "google" ? "🗺️" : "🚗"}</span>
                <span>{opt.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Botón Principal: Continuar Traslado */}
      <Link
        href={getContinuarTrasladoHref(viaje)}
        className="w-full min-h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus:outline-hidden mt-1"
      >
        CONTINUAR TRASLADO →
      </Link>
    </div>
  );
}
