"use client";

import Link from "next/link";
import type { PasaporteRow, DetalleOperativo } from "./trips-utils";
import { formatearDuracion, nombreVehiculo } from "./trips-utils";

function getEstadoCardInfo(estado: string) {
  switch (estado) {
    case "conductor_asignado":
      return {
        dotColor: "bg-amber-400",
        textColor: "text-amber-300",
        badgeBg: "bg-amber-400/20 text-amber-300 border-amber-400/40",
        titulo: "PENDIENTE DE INICIO",
        descripcion: "Dirígete al punto de origen."
      };
    case "conductor_en_camino_al_origen":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "EN CAMINO AL ORIGEN",
        descripcion: "Dirígete al punto de recolección."
      };
    case "conductor_en_punto_de_recoleccion":
    case "verificacion_vehiculo_en_proceso":
    case "evidencia_inicial_en_proceso":
    case "evidencia_inicial_completada":
    case "vehiculo_recibido":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "EN PUNTO DE ORIGEN",
        descripcion: "Realiza la recepción y evidencia del vehículo."
      };
    case "traslado_en_curso":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "TRASLADO EN CURSO",
        descripcion: "Conduce de forma segura al destino."
      };
    case "llegada_a_destino":
    case "evidencia_final_en_proceso":
    case "evidencia_final_completada":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "LLEGADA A DESTINO",
        descripcion: "Entrega la unidad y registra la evidencia final."
      };
    case "entrega_confirmada":
    case "servicio_cerrado":
      return {
        dotColor: "bg-emerald-400",
        textColor: "text-emerald-300",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        titulo: "TRASLADO FINALIZADO",
        descripcion: "El traslado ha sido concluido."
      };
    default:
      return {
        dotColor: "bg-amber-400",
        textColor: "text-amber-300",
        badgeBg: "bg-amber-400/20 text-amber-300 border-amber-400/40",
        titulo: "PENDIENTE DE INICIO",
        descripcion: "Dirígete al punto de origen."
      };
  }
}

interface AcceptedTripCardProps {
  viaje: PasaporteRow;
  detalle: DetalleOperativo;
  onReject: (viaje: PasaporteRow) => void;
  hrefDetalle: string;
}

export function AcceptedTripCard({
  viaje,
  detalle,
  onReject,
  hrefDetalle
}: AcceptedTripCardProps) {
  const folio = viaje.traslado_id ? viaje.traslado_id.slice(0, 8).toUpperCase() : "POR CONFIRMAR";
  const ganancia = viaje.ganancia_conductor != null
    ? `$${viaje.ganancia_conductor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "$0.00";

  const origen = viaje.origen_ciudad || "Por confirmar";
  const destino = viaje.destino_ciudad || "Por confirmar";
  const autoNombre = nombreVehiculo(viaje);

  const horaInicio = detalle.fechaHora
    ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(new Date(detalle.fechaHora))
    : "10:30";

  const duracionHoras = viaje.tiempo_estimado_horas || null;
  const duracionTexto = formatearDuracion(duracionHoras);
  const distanciaTexto = viaje.distancia_km != null ? `${viaje.distancia_km.toFixed(1)} km` : "Por confirmar";

  const cardInfo = getEstadoCardInfo(viaje.estado || "");

  return (
    <div className="w-full rounded-2xl border border-border/20 bg-surface-elevated p-4 shadow-sm flex flex-col gap-3 text-left select-none">
      {/* Cabecera: ID + Tarifa + Botón de Opciones */}
      <div className="flex items-center justify-between gap-2 border-b border-border/15 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-body text-[9.5px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <svg className="w-2.5 h-2.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            ACEPTADO
          </span>
          <span className="font-mono text-[10px] font-extrabold text-text-tertiary tracking-wider uppercase">
            ID {folio}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-display text-xs sm:text-sm font-black text-text-primary leading-none tabular-nums bg-surface border border-border/20 px-2.5 py-1 rounded-lg">
            {ganancia}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReject(viaje);
            }}
            className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors shrink-0 cursor-pointer rounded-lg hover:bg-surface"
            aria-label="Opciones de traslado"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Indicador de Estado */}
      <div className="flex flex-col text-left">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase border self-start ${cardInfo.badgeBg}`}>
          <span className={`h-2 w-2 rounded-full ${cardInfo.dotColor} animate-pulse shrink-0`} />
          <span>{cardInfo.titulo}</span>
        </div>
        <p className="font-body text-[10px] text-text-secondary mt-1 leading-snug">
          {cardInfo.descripcion}
        </p>
      </div>

      {/* Vehículo */}
      {autoNombre !== "Vehículo" && (
        <div className="flex items-center gap-2 text-xs font-bold text-text-primary">
          <span>🚗</span>
          <span className="truncate">{autoNombre}</span>
        </div>
      )}

      {/* Conector gráfico de Línea de Ruta */}
      <div className="flex items-center justify-between gap-3 py-2 bg-surface/60 border border-border/15 rounded-xl px-3">
        <div className="flex flex-col text-left min-w-0 flex-1">
          <span className="font-display text-[8.5px] font-bold text-emerald-400 tracking-widest uppercase">Origen</span>
          <span className="font-display text-xs font-black text-text-primary leading-tight truncate mt-0.5">{origen}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 px-1 select-none" aria-hidden="true">
          <span className="h-2 w-2 rounded-full border-2 border-emerald-400 bg-transparent shrink-0" />
          <div className="h-[2px] w-6 sm:w-10 bg-gradient-to-r from-emerald-400 via-border/40 to-route-action rounded-full" />
          <span className="h-2 w-2 rounded-full bg-route-action shrink-0" />
        </div>

        <div className="flex flex-col text-right min-w-0 flex-1">
          <span className="font-display text-[8.5px] font-bold text-route-action tracking-widest uppercase">Destino</span>
          <span className="font-display text-xs font-black text-text-primary leading-tight truncate mt-0.5">{destino}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 select-none border-t border-border/15 pt-2.5">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Hora</span>
            <span className="text-text-primary text-[11px] font-extrabold mt-0.5 leading-none">{horaInicio}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-l border-border/15 pl-2">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 15 15" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Duración</span>
            <span className="text-text-primary text-[11px] font-extrabold mt-0.5 leading-none">{duracionTexto}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-l border-border/15 pl-2">
          <svg className="w-3.5 h-3.5 text-text-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 22 L9 2 L15 2 L21 22" />
            <path d="M12 2 L12 22" strokeDasharray="2 2" />
            <path d="M6 14 L18 14" />
          </svg>
          <div className="flex flex-col text-left">
            <span className="text-text-tertiary text-[7.5px] font-bold uppercase tracking-wider leading-none">Distancia</span>
            <span className="text-text-primary text-[11px] font-extrabold mt-0.5 leading-none">{distanciaTexto}</span>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <Link
        href={hrefDetalle}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-route-action hover:bg-route-action/85 active:scale-[0.98] px-4 font-display text-xs font-black tracking-widest text-slate-950 uppercase transition-all shadow-sm select-none cursor-pointer mt-0.5"
      >
        INICIAR TRASLADO →
      </Link>
    </div>
  );
}
