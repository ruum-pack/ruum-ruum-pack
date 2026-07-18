export default function CargandoGanancias() {
  return (
    <div className="conductor-content" role="status" aria-label="Cargando ganancias" aria-busy="true">
      {/* Skeleton resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-[rgba(122,162,214,0.22)] bg-[#101A2C] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.30)]">
            <div className="h-3 w-20 animate-pulse rounded bg-[rgba(183,194,212,0.18)]" />
            <div className="h-7 w-14 animate-pulse rounded bg-[rgba(232,237,246,0.20)]" />
          </div>
        ))}
      </div>
      {/* Skeleton tabla */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[rgba(122,162,214,0.22)] bg-[#101A2C]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[rgba(122,162,214,0.14)] px-4 py-3 last:border-0">
            <div className="h-3 w-20 animate-pulse rounded bg-[rgba(183,194,212,0.18)]" />
            <div className="h-3 flex-1 animate-pulse rounded bg-[rgba(183,194,212,0.18)]" />
            <div className="h-3 w-16 animate-pulse rounded bg-[rgba(183,194,212,0.18)]" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-[rgba(61,220,151,0.16)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
