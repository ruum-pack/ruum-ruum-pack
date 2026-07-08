export default function CargandoConductores() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 sm:px-8 sm:py-10" aria-label="Cargando conductores">
      <div className="h-7 w-36 animate-pulse rounded bg-ink/8" />
      <div className="mt-6 overflow-hidden rounded-card border border-ink/10">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-ink/5 px-4 py-4 last:border-0">
            <div className="h-3 w-32 animate-pulse rounded bg-ink/8" />
            <div className="h-3 w-20 animate-pulse rounded bg-ink/6" />
            <div className="h-3 w-12 animate-pulse rounded bg-ink/6" />
            <div className="h-3 w-16 animate-pulse rounded bg-ink/6 ml-auto" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-ink/8" />
          </div>
        ))}
      </div>
    </div>
  );
}
