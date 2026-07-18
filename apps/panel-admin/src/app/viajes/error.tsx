"use client";

import Link from "next/link";

export default function ErrorViajes({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="font-display text-xl font-semibold">No pudimos cargar los traslados</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        Falla temporal de conexión. Intenta de nuevo en unos segundos.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-surface-primary px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40">
          Reintentar
        </button>
        <Link href="/" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-display text-sm font-bold text-ink transition hover:bg-signal/90">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
