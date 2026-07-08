export default function CargandoNuevoTraslado() {
  return (
    <main className="app-page">
      <div className="app-container py-12" aria-label="Cargando formulario">
        <div className="mx-auto max-w-xl">
          <div className="h-7 w-48 animate-pulse rounded bg-ink/8 mb-2" />
          {/* Skeleton stepper */}
          <div className="mt-6 flex gap-2 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-4 flex-1 animate-pulse rounded bg-ink/6" />
            ))}
          </div>
          {/* Skeleton PassportCard */}
          <div className="app-card rounded-card p-6 space-y-4">
            <div className="h-4 w-32 animate-pulse rounded bg-ink/8" />
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink/6" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
