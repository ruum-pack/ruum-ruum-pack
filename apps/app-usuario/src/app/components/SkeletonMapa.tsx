export function SkeletonMapa({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-64 w-full overflow-hidden rounded-card bg-ink/8 ${className}`} aria-label="Cargando mapa">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink/5 to-ink/10" />
      <div className="absolute left-8 top-8 h-3 w-28 animate-pulse rounded bg-ink/8" />
      <div className="absolute right-10 top-16 h-3 w-36 animate-pulse rounded bg-ink/6" />
      <div className="absolute inset-x-4 bottom-4 z-10 h-20 animate-pulse rounded-[var(--ruum-radius-modal)] bg-mist/90 shadow-3" />
    </div>
  );
}
