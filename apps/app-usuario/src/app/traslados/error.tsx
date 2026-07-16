"use client";

import Link from "next/link";

export default function ErrorTraslados({ reset }: { reset: () => void }) {
  return (
    <main className="app-page">
      <div className="app-container flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-danger-soft">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            className="text-danger" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <h1 className="font-display text-xl font-semibold">Error al cargar el traslado</h1>
        <p className="mt-2 font-body text-sm text-ink/60">
          No pudimos obtener la información del traslado. Intenta de nuevo o consulta tu lista de viajes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40"
          >
            Reintentar
          </button>
          <Link href="/mis-viajes" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-signal px-4 py-2 font-display text-sm font-bold text-ink transition hover:bg-signal/90">
            Mis viajes
          </Link>
        </div>
      </div>
    </main>
  );
}
