"use client";

import Link from "next/link";

export default function ErrorTraslado({ reset }: { reset: () => void }) {
  return (
    <main className="app-page">
      <div className="app-container py-20 text-center">
        <h1 className="font-display text-xl font-semibold">No pudimos cargar este traslado</h1>
        <p className="mt-2 font-body text-sm leading-6 text-ink/60">
          Ocurrió un error al obtener los datos del traslado. Puede ser una falla
          temporal — intenta de nuevo o revisa tu lista de viajes.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40"
          >
            Reintentar
          </button>
          <Link href="/mis-viajes" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-signal px-4 py-2 font-display text-sm font-bold text-ink transition hover:bg-signal/90">
            Ver mis viajes
          </Link>
        </div>
      </div>
    </main>
  );
}
