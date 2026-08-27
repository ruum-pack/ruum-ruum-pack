"use client";

import Link from "next/link";
import { folioViaje, type PasaporteRow } from "./panel-utils";

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

export function PanelActiveTripCard({ viaje }: PanelActiveTripCardProps) {
  if (!viaje.estado) return null;

  return (
    <div className="w-full p-5 rounded-3xl bg-surface-elevated border border-border/30 text-text-primary flex flex-col gap-4 shadow-lg text-left relative">
      {/* 1. Header: Traslado Activo */}
      <div className="flex justify-between items-center w-full">
        <span className="text-text-primary dark:text-signal text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 bg-signal/20 dark:bg-signal/10 border border-signal/40 px-3 py-1 rounded-full">
          <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
          Traslado Activo
        </span>
      </div>

      {/* 2. #Traslado en grande */}
      <div className="flex flex-col py-1">
        <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
          Número de Traslado
        </span>
        <button
          type="button"
          onClick={() => {
            if (navigator.clipboard) void navigator.clipboard.writeText(folioViaje(viaje));
          }}
          className="font-mono text-2xl sm:text-3xl font-black text-text-primary mt-0.5 tracking-tight text-left hover:text-route-action transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action rounded"
          title="Copiar folio"
          aria-label={`Copiar folio ${folioViaje(viaje)}`}
        >
          #{folioViaje(viaje)}
        </button>
      </div>

      {/* 3. Paso Actual */}
      <div className="border-t border-border/15 pt-3.5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-route-action/10 border border-route-action/20 flex items-center justify-center text-route-action shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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

      {/* 4. Botón de continuar traslado */}
      <Link
        href={getContinuarTrasladoHref(viaje)}
        className="w-full min-h-12 rounded-2xl bg-signal hover:bg-signal/85 text-slate-950 font-display text-sm font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal mt-1"
      >
        Continuar traslado →
      </Link>
    </div>
  );
}
