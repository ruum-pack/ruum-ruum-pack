export default function CargandoViajes() {
  return (
    <output className="conductor-content" aria-label="Cargando viajes" aria-busy="true">
      {/* Skeleton pestañas */}
      <div className="flex gap-2 border-b border-border pb-0">
        {[100, 110].map((w, i) => (
          <div key={i} className="h-10 animate-pulse rounded-t bg-surface-elevated" style={{ width: `${w}px` }} />
        ))}
      </div>
      {/* Skeleton cards de viaje */}
      <div className="mt-5 grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-card border border-border p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-surface-elevated" />
                <div className="h-3 w-24 animate-pulse rounded bg-surface-elevated" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-surface-elevated" />
            </div>
            <div className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
          </div>
        ))}
      </div>
    </output>
  );
}
