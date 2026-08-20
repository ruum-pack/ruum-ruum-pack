"use client";

import Link from "next/link";
import type { PasaporteRow } from "./panel-utils";
import type { Disponibilidad } from "./usePanelData";

interface PanelOpportunitiesCardProps {
  disponibilidad: Disponibilidad;
  viajesDisponibles: PasaporteRow[];
}

export function PanelOpportunitiesCard({
  disponibilidad,
  viajesDisponibles
}: PanelOpportunitiesCardProps) {
  const esDisponible = disponibilidad === "disponible";
  const cantidadDisponibles = viajesDisponibles.length;
  const primerViaje = viajesDisponibles[0] ?? null;

  return (
    <div className="w-full p-5 rounded-3xl bg-surface-elevated border border-route-action/30 text-text-primary flex flex-col gap-4 shadow-lg text-left relative overflow-hidden">
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-1 max-w-[75%]">
          <span className="text-route-action text-[10px] font-extrabold uppercase tracking-widest leading-none flex items-center gap-1.5">
            {esDisponible && <span className="h-2 w-2 rounded-full bg-route-action animate-ping" />}
            {esDisponible ? "Traslados Disponibles" : "Modo No Disponible"}
          </span>
          <h2 className="font-display text-lg font-black tracking-tight text-text-primary leading-tight mt-2">
            {esDisponible
              ? cantidadDisponibles > 0
                ? `${cantidadDisponibles} traslado${cantidadDisponibles > 1 ? "s" : ""} disponible${cantidadDisponibles > 1 ? "s" : ""} en tu zona`
                : "Buscando nuevas oportunidades…"
              : "Actívate para recibir solicitudes"}
          </h2>
          <p className="font-body text-xs text-text-secondary mt-1 leading-normal">
            {esDisponible
              ? cantidadDisponibles > 0
                ? "Revisa los detalles y toma el traslado que mejor se ajuste a tu ruta."
                : "Mantente en línea. Te notificaremos en cuanto haya viajes en tu radio operativo."
              : "Cambia tu estado a Disponible para que la plataforma te asigne nuevos viajes."}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-route-action/10 border border-route-action/20 flex items-center justify-center text-route-action shrink-0 shadow-xs">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </div>
      </div>

      {/* Vista previa rápida del primer viaje disponible si existe y está en línea */}
      {esDisponible && primerViaje && (
        <div className="p-3 rounded-2xl bg-surface border border-border/20 flex items-center justify-between text-left">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-tertiary font-bold uppercase">
              Ruta destacada
            </span>
            <span className="text-xs font-black text-text-primary mt-0.5">
              {primerViaje.origen_ciudad || "Origen"} ➔ {primerViaje.destino_ciudad || "Destino"}
            </span>
          </div>
          <span className="text-xs font-black text-signal tabular-nums">
            {primerViaje.ganancia_conductor
              ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(primerViaje.ganancia_conductor)
              : "Ver pago"}
          </span>
        </div>
      )}

      <Link
        href="/viajes"
        className={`w-full min-h-12 rounded-2xl font-display text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus:outline-hidden mt-1 ${
          esDisponible
            ? "bg-route-action hover:bg-route-action/85 text-slate-950"
            : "bg-surface hover:bg-surface-elevated text-text-primary border border-border/40"
        }`}
      >
        {esDisponible ? (cantidadDisponibles > 0 ? `VER TRASLADOS (${cantidadDisponibles}) →` : "VER BANDEJA DE TRASLADOS →") : "EXPLORAR TRASLADOS →"}
      </Link>
    </div>
  );
}
