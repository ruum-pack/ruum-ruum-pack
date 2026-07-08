export default function CargandoViajes() {
  return (
    <div className="conductor-content" aria-label="Cargando viajes">
      {/* Skeleton pestañas */}
      <div className="flex gap-2 border-b border-ink/10 pb-0">
        {[100, 110].map((w, i) => (
          <div key={i} className="h-10 animate-pulse rounded-t bg-ink/6" style={{ width: `${w}px` }} />
        ))}
      </div>
      {/* Skeleton cards de viaje */}
      <div className="mt-5 grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-card border border-ink/10 p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-ink/8" />
                <div className="h-3 w-24 animate-pulse rounded bg-ink/6" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-ink/8" />
            </div>
            <div className="h-10 animate-pulse rounded-lg bg-ink/6" />
          </div>
        ))}
      </div>
    </div>
  );
}
