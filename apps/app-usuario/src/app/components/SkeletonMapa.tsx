export function SkeletonMapa({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-64 w-full overflow-hidden rounded-card bg-ink/8 ${className}`} aria-label="Cargando mapa">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink/5 to-ink/10" />
      <div className="absolute left-8 top-8 h-3 w-28 animate-pulse rounded bg-ink/8" />
      <div className="absolute right-10 top-16 h-3 w-36 animate-pulse rounded bg-ink/6" />
      <div className="absolute bottom-4 left-4 right-4 h-20 animate-pulse rounded-xl bg-mist/90 shadow-[0_16px_40px_rgba(26,31,46,0.18)]" />
    </div>
  );
}
