"use client";

export type OrdenViajes = "recientes" | "mayor_ganancia" | "menor_distancia";

interface ViajesFiltersProps {
  orden: OrdenViajes;
  onCambiarOrden: (orden: OrdenViajes) => void;
  ciudadFiltro: string;
  onCambiarCiudad: (ciudad: string) => void;
  ciudadesDisponibles: string[];
}

const ORDENES: Array<{ valor: OrdenViajes; etiqueta: string }> = [
  { valor: "recientes", etiqueta: "Recientes" },
  { valor: "mayor_ganancia", etiqueta: "Mayor ganancia" },
  { valor: "menor_distancia", etiqueta: "Menor distancia" }
];

function IconOrden({ valor, className }: { valor: OrdenViajes; className?: string }) {
  if (valor === "recientes")
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  if (valor === "mayor_ganancia")
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

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
              <IconOrden valor={o.valor} />
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
