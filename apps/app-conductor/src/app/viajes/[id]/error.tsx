"use client";

import Link from "next/link";

export default function ErrorDetalleViaje({ reset }: { reset: () => void }) {
  return (
    <div className="conductor-content flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-xl font-semibold">Error al cargar este viaje</h1>
      <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
        No pudimos obtener los datos del traslado. Puede ser una falla temporal de conexión.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary transition hover:border-border-strong">
          Reintentar
        </button>
        <Link href="/viajes" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-2.5 font-display text-sm font-bold text-text-primary transition hover:bg-signal/90">
          Ver mis viajes
        </Link>
      </div>
    </div>
  );
}
