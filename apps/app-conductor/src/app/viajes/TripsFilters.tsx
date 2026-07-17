import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import { FILTROS_FECHA, type EstadoTraslado, type FiltroFecha } from "./trips-utils";

export function TripsFilters({
  filtroFecha,
  filtroEstado,
  estadosFiltro,
  onChange
}: {
  filtroFecha: FiltroFecha;
  filtroEstado: string;
  estadosFiltro: EstadoTraslado[];
  onChange: (cambios: Partial<Record<"vista" | "grupo" | "fecha" | "estado", string>>) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface px-4 py-4 sm:grid-cols-2">
      <label className="grid gap-1">
        <span className="font-body text-sm font-semibold text-text-tertiary">Fecha</span>
        <select
          value={filtroFecha}
          onChange={(event) => onChange({ fecha: event.target.value })}
          className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base"
        >
          {FILTROS_FECHA.map((item) => (
            <option key={item.id} value={item.id}>{item.etiqueta}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="font-body text-sm font-semibold text-text-tertiary">Estado</span>
        <select
          value={estadosFiltro.includes(filtroEstado as EstadoTraslado) ? filtroEstado : "todos"}
          onChange={(event) => onChange({ estado: event.target.value })}
          className="min-h-11 rounded-lg border border-border bg-surface px-3 font-body text-base"
        >
          <option value="todos">Todos los estados</option>
          {estadosFiltro.map((estado) => (
            <option key={estado} value={estado}>{ETIQUETA_ESTADO_TRASLADO[estado]}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
