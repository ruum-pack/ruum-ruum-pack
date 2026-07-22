export default function CargandoGanancias() {
  return (
    <output className="conductor-content" aria-label="Cargando ganancias" aria-busy="true">
      {/* Skeleton resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-border/22 bg-surface p-4 shadow-[0_10px_28px_rgba(0,0,0,0.30)]">
            <div className="h-3 w-20 animate-pulse rounded bg-text-secondary/18" />
            <div className="h-7 w-14 animate-pulse rounded bg-text-primary/20" />
          </div>
        ))}
      </div>
      {/* Skeleton tabla */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border/22 bg-surface">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border/14 px-4 py-3 last:border-0">
            <div className="h-3 w-20 animate-pulse rounded bg-text-secondary/18" />
            <div className="h-3 flex-1 animate-pulse rounded bg-text-secondary/18" />
            <div className="h-3 w-16 animate-pulse rounded bg-text-secondary/18" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-success/16" />
          </div>
        ))}
      </div>
    </output>
  );
}
