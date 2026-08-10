"use client";

import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import { FILTROS_FECHA, type EstadoTraslado, type FiltroFecha } from "./trips-utils";

export function TripsFilters({
  filtroFecha,
  filtroEstado,
  estadosFiltro,
  totalItems,
  onChange
}: {
  filtroFecha: FiltroFecha;
  filtroEstado: string;
  estadosFiltro: EstadoTraslado[];
  totalItems?: number;
  onChange: (cambios: Partial<Record<"vista" | "grupo" | "fecha" | "estado", string>>) => void;
}) {
  const tieneFiltrosAplicados = filtroFecha !== "todos" || filtroEstado !== "todos";
  const deshabilitado = totalItems === 0 && !tieneFiltrosAplicados;

  const filtrosActivos = [
    filtroFecha !== "todos" ? FILTROS_FECHA.find((item) => item.id === filtroFecha)?.etiqueta : null,
    estadosFiltro.includes(filtroEstado as EstadoTraslado) ? ETIQUETA_ESTADO_TRASLADO[filtroEstado as EstadoTraslado] : null
  ].filter(Boolean);

  if (deshabilitado) {
    return (
      <div className="mt-4 rounded-2xl border border-border/40 bg-surface-elevated/30 px-4 py-3 font-body text-xs font-semibold text-text-tertiary flex items-center justify-between opacity-60 cursor-not-allowed">
        <span className="flex items-center gap-1.5 font-display">
          <span>🔍</span> Filtros de búsqueda
        </span>
        <span className="text-[11px] font-normal italic">Sin resultados para filtrar (0 traslados en esta sección)</span>
      </div>
    );
  }

  return (
    <details className="mt-4 rounded-2xl border border-border/40 bg-surface shadow-2xs">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-text-primary hover:text-route-action [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span>🔍</span> Filtros de búsqueda
        </span>
        <span className="flex items-center gap-2 font-body text-xs font-semibold text-text-tertiary">
          {filtrosActivos.length > 0 ? (
            <span className="rounded-full bg-signal/20 px-2.5 py-0.5 font-bold text-signal">
              {filtrosActivos.join(" · ")}
            </span>
          ) : (
            <span>Todos los registros</span>
          )}
          <span className="font-display text-lg leading-none text-text-tertiary" aria-hidden>+</span>
        </span>
      </summary>
      <div className="grid gap-3 border-t border-border/40 px-4 py-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Filtro por Fecha</span>
          <select
            value={filtroFecha}
            onChange={(event) => onChange({ fecha: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-surface px-3 font-body text-sm text-text-primary"
          >
            {FILTROS_FECHA.map((item) => (
              <option key={item.id} value={item.id}>{item.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-text-tertiary">Filtro por Estado</span>
          <select
            value={estadosFiltro.includes(filtroEstado as EstadoTraslado) ? filtroEstado : "todos"}
            onChange={(event) => onChange({ estado: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-surface px-3 font-body text-sm text-text-primary"
          >
            <option value="todos">Todos los estados</option>
            {estadosFiltro.map((estado) => (
              <option key={estado} value={estado}>{ETIQUETA_ESTADO_TRASLADO[estado]}</option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}
