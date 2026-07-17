export default function CargandoGanancias() {
  return (
    <div className="conductor-content" aria-label="Cargando ganancias">
      {/* Skeleton resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-card border border-border p-4 space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
            <div className="h-7 w-14 animate-pulse rounded bg-surface-elevated" />
          </div>
        ))}
      </div>
      {/* Skeleton tabla */}
      <div className="mt-6 rounded-card border border-border overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-elevated" />
            <div className="h-3 flex-1 animate-pulse rounded bg-surface-elevated" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface-elevated" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-surface-elevated" />
          </div>
        ))}
      </div>
    </div>
  );
}
