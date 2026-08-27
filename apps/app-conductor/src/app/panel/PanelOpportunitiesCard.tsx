"use client";

import Link from "next/link";
import type { PasaporteRow } from "./panel-utils";
import type { Disponibilidad } from "./usePanelData";

interface PanelOpportunitiesCardProps {
  disponibilidad: Disponibilidad;
  viajesDisponibles: PasaporteRow[];
  gananciasHoy?: number;
  trasladosHoy?: number;
  ultimaActualizacion?: Date | null;
  refrescando?: boolean;
  onRecargar?: () => void;
  onActivar?: () => void;
}

function formatoHaceMinutos(fecha: Date | null | undefined) {
  if (!fecha) return null;
  const diffMs = Date.now() - fecha.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "hace segundos";
  if (mins === 1) return "hace 1 min";
  return `hace ${mins} min`;
}

export function PanelOpportunitiesCard({
  disponibilidad,
  viajesDisponibles,
  gananciasHoy = 0,
  trasladosHoy = 0,
  ultimaActualizacion,
  refrescando = false,
  onRecargar,
  onActivar
}: PanelOpportunitiesCardProps) {
  const esDisponible = disponibilidad === "disponible";
  const cantidadDisponibles = viajesDisponibles.length;
  const primerViaje = viajesDisponibles[0] ?? null;
  const hace = formatoHaceMinutos(ultimaActualizacion);
  const promedioEstimado = trasladosHoy > 0 ? Math.round(gananciasHoy / trasladosHoy) : 850;

  return (
    <div className="w-full p-5 rounded-3xl bg-surface-elevated border border-border/30 text-text-primary flex flex-col gap-4 shadow-lg text-left relative overflow-hidden">
      <div className="flex justify-between items-start w-full">
        <div className="flex flex-col gap-1 max-w-[75%]">
          <span className="text-route-action text-[10px] font-extrabold uppercase tracking-widest leading-none flex items-center gap-1.5">
            {esDisponible && <span className="h-2 w-2 rounded-full bg-signal" aria-hidden />}
            {esDisponible ? "Traslados Disponibles" : "Modo No Disponible"}
          </span>
          <h2 className="font-display text-lg font-black tracking-tight text-text-primary leading-tight mt-2">
            {esDisponible
              ? cantidadDisponibles > 0
                ? `${cantidadDisponibles} traslado${cantidadDisponibles > 1 ? "s" : ""} disponible${cantidadDisponibles > 1 ? "s" : ""} en tu zona`
                : "Sin traslados por ahora"
              : "Actívate y empieza a ganar"}
          </h2>
          <p className="font-body text-xs text-text-secondary mt-1 leading-normal">
            {esDisponible
              ? cantidadDisponibles > 0
                ? "Revisa los detalles y toma el traslado que mejor se ajuste a tu ruta."
                : hace
                  ? `Última búsqueda ${hace} · Te avisaremos con sonido en cuanto haya viajes.`
                  : "Te avisaremos con sonido en cuanto haya viajes en tu radio operativo."
              : `Gana en promedio ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(promedioEstimado)} por traslado hoy en tu zona. Actívate en un toque.`}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-route-action/10 border border-route-action/20 flex items-center justify-center text-route-action shrink-0 shadow-xs">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
          <span className="text-xs font-black text-text-primary tabular-nums">
            {primerViaje.ganancia_conductor
              ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(primerViaje.ganancia_conductor)
              : "Ver pago"}
          </span>
        </div>
      )}

      {/* CTA contextual según estado */}
      {!esDisponible ? (
        <button
          type="button"
          onClick={onActivar}
          className="w-full min-h-12 rounded-2xl font-display text-sm font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-signal mt-1 bg-signal hover:bg-signal/90 text-slate-950"
        >
          Activarme ahora →
        </button>
      ) : cantidadDisponibles === 0 ? (
        <div className="flex gap-2 mt-1">
          <Link
            href="/viajes"
            className="flex-1 min-h-12 rounded-2xl font-display text-sm font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action bg-surface hover:bg-surface-elevated text-text-primary border border-border/40"
          >
            Ver bandeja →
          </Link>
          <button
            type="button"
            onClick={onRecargar}
            disabled={refrescando}
            className="shrink-0 min-h-12 px-4 rounded-2xl font-display text-sm font-bold border border-border bg-surface hover:bg-surface-elevated text-text-primary focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action disabled:opacity-50"
          >
            {refrescando ? "Buscando…" : "Buscar ahora"}
          </button>
        </div>
      ) : (
        <Link
          href="/viajes"
          className="w-full min-h-12 rounded-2xl font-display text-sm font-black tracking-wide transition-all cursor-pointer shadow-md select-none flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action mt-1 bg-signal hover:bg-signal/85 text-slate-950"
        >
          {`Ver traslados (${cantidadDisponibles}) →`}
        </Link>
      )}
      {esDisponible && cantidadDisponibles === 0 && hace && (
        <p className="font-body text-[11px] text-text-tertiary text-center -mt-1">
          Actualizado {hace} · Pull para refrescar
        </p>
      )}
    </div>
  );
}
