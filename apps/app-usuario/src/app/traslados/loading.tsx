export default function CargandoTraslados() {
  return (
    <main className="app-page">
      <div className="app-container py-10 sm:py-14" aria-label="Cargando traslado">
        {/* Skeleton de PassportCard */}
        <div className="app-card rounded-card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-ink/8" />
              <div className="h-3 w-28 animate-pulse rounded bg-ink/6" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded-full bg-ink/8" />
          </div>
          {/* Skeleton stepper */}
          <div className="mt-6 flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="h-6 w-6 animate-pulse rounded-full bg-ink/10" />
                <div className="h-2 w-full animate-pulse rounded bg-ink/6" />
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton de detalle */}
        <div className="mt-6 app-card rounded-card p-6 space-y-4">
          {[120, 90, 140, 80].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-ink/8" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
    </main>
  );
}
