"use client";

export type OrdenViajes = "recientes" | "mayor_ganancia" | "menor_distancia";

interface ViajesFiltersProps {
  orden: OrdenViajes;
  onCambiarOrden: (orden: OrdenViajes) => void;
  ciudadFiltro: string;
  onCambiarCiudad: (ciudad: string) => void;
  ciudadesDisponibles: string[];
}

const ORDENES: Array<{ valor: OrdenViajes; etiqueta: string; icono: string }> = [
  { valor: "recientes", etiqueta: "Recientes", icono: "🕒" },
  { valor: "mayor_ganancia", etiqueta: "Mayor ganancia", icono: "💰" },
  { valor: "menor_distancia", etiqueta: "Menor distancia", icono: "📍" }
];

export function ViajesFilters({
  orden,
  onCambiarOrden,
  ciudadFiltro,
  onCambiarCiudad,
  ciudadesDisponibles
}: ViajesFiltersProps) {
  return (
    <div className="mt-3 flex flex-col gap-2.5 select-none">
      {/* Orden — chips horizontales scrolleables, 1-tap */}
      <div className="flex items-center gap-2">
        <span className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary shrink-0">Orden:</span>
        <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1 py-1" role="group" aria-label="Ordenar ofertas">
          {ORDENES.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => onCambiarOrden(o.valor)}
              aria-pressed={orden === o.valor}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 font-body text-xs font-bold transition-all min-h-9 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
                orden === o.valor ? "bg-signal border-signal text-slate-950 shadow-sm" : "bg-surface-elevated border-border/40 text-text-secondary hover:border-route-action/30 hover:text-text-primary"
              }`}
            >
              <span aria-hidden>{o.icono}</span>
              {o.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* Ciudad — chips (solo si hay >1) */}
      {ciudadesDisponibles.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="font-body text-[10px] font-bold uppercase tracking-wider text-text-tertiary shrink-0">Ciudad:</span>
          <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1 py-1" role="group" aria-label="Filtrar por ciudad">
            <button
              type="button"
              onClick={() => onCambiarCiudad("todas")}
              aria-pressed={ciudadFiltro === "todas"}
              className={`shrink-0 rounded-full border px-3 py-2 font-body text-xs font-bold transition-all min-h-9 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
                ciudadFiltro === "todas" ? "bg-surface border-text-primary text-text-primary" : "bg-surface-elevated border-border/40 text-text-tertiary hover:text-text-primary"
              }`}
            >
              Todas
            </button>
            {ciudadesDisponibles.map((ciudad) => (
              <button
                key={ciudad}
                type="button"
                onClick={() => onCambiarCiudad(ciudad)}
                aria-pressed={ciudadFiltro === ciudad}
                className={`shrink-0 rounded-full border px-3 py-2 font-body text-xs font-bold transition-all min-h-9 max-w-[160px] truncate focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-route-action ${
                  ciudadFiltro === ciudad ? "bg-signal border-signal text-slate-950 shadow-sm" : "bg-surface-elevated border-border/40 text-text-secondary hover:border-route-action/30 hover:text-text-primary"
                }`}
                title={ciudad}
              >
                {ciudad}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
