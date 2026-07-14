export default function CargandoMisViajes() {
  return (
    <main className="app-page">
      <div className="app-container py-10 sm:py-14" aria-label="Cargando tus viajes">
        {/* Skeleton de tabs */}
        <div className="mb-6 flex gap-2">
          {[80, 90, 90, 80].map((w, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-full bg-ink/8"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>

        {/* Skeleton de cards */}
        <div className="divide-y divide-ink/10 rounded-card border border-ink/10 bg-mist">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-ink/8" />
                <div className="h-3 w-32 animate-pulse rounded bg-ink/6" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-ink/8" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
