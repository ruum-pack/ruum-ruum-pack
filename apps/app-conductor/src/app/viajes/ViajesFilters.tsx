"use client";

export type OrdenViajes = "recientes" | "mayor_ganancia" | "menor_distancia";

interface ViajesFiltersProps {
  orden: OrdenViajes;
  onCambiarOrden: (orden: OrdenViajes) => void;
  ciudadFiltro: string;
  onCambiarCiudad: (ciudad: string) => void;
  ciudadesDisponibles: string[];
}

export function ViajesFilters({
  orden,
  onCambiarOrden,
  ciudadFiltro,
  onCambiarCiudad,
  ciudadesDisponibles
}: ViajesFiltersProps) {
  if (ciudadesDisponibles.length <= 1 && orden === "recientes") {
    // Si no hay múltiples ciudades ni opciones complejas, mantenemos la barra simple
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-3 select-none">
      {/* Selector de Ciudad si hay varias */}
      {ciudadesDisponibles.length > 1 ? (
        <select
          value={ciudadFiltro}
          onChange={(e) => onCambiarCiudad(e.target.value)}
          className="bg-surface-elevated border border-border/20 text-text-primary text-xs font-bold rounded-xl px-3 py-2 min-h-11 outline-hidden cursor-pointer w-full sm:w-auto"
          aria-label="Filtrar por ciudad de origen"
        >
          <option value="todas">📍 Todas las ciudades</option>
          {ciudadesDisponibles.map((ciudad) => (
            <option key={ciudad} value={ciudad}>
              📍 {ciudad}
            </option>
          ))}
        </select>
      ) : (
        <div className="hidden sm:block" />
      )}

      {/* Selector de Ordenamiento */}
      <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
        <span className="text-xs font-extrabold uppercase tracking-wide text-text-tertiary shrink-0">Orden:</span>
        <select
          value={orden}
          onChange={(e) => onCambiarOrden(e.target.value as OrdenViajes)}
          className="bg-surface-elevated border border-border/20 text-text-primary text-xs font-bold rounded-xl px-3 py-2 min-h-11 outline-hidden cursor-pointer flex-1 sm:flex-none min-w-0"
          aria-label="Ordenar lista de viajes"
        >
          <option value="recientes">Recientes</option>
          <option value="mayor_ganancia">Mayor ganancia ($)</option>
          <option value="menor_distancia">Menor distancia (km)</option>
        </select>
      </div>
    </div>
  );
}
