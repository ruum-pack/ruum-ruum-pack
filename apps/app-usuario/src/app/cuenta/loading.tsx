export default function CargandoCuenta() {
  return (
    <main className="app-page">
      <div className="app-container py-10 sm:py-14" aria-label="Cargando cuenta">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Skeleton del menú lateral */}
          <div className="app-card rounded-card p-5 space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-12 rounded-full animate-pulse bg-ink/8" />
              <div className="space-y-2">
                <div className="h-3.5 w-28 animate-pulse rounded bg-ink/8" />
                <div className="h-3 w-20 animate-pulse rounded bg-ink/6" />
              </div>
            </div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-ink/6" />
            ))}
          </div>
          {/* Skeleton del contenido */}
          <div className="app-card rounded-card p-6 space-y-5">
            <div className="h-5 w-40 animate-pulse rounded bg-ink/8" />
            <div className="h-3 w-64 animate-pulse rounded bg-ink/6" />
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink/6" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
