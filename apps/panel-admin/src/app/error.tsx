"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorGlobalAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[panel-admin/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-red-50">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
        </svg>
      </div>
      <h1 className="font-display text-2xl font-semibold">Algo salió mal</h1>
      <p className="mt-3 max-w-sm font-body text-sm leading-6 text-ink/60">
        Ocurrió un error inesperado en el panel. Puedes reintentar o volver al dashboard.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="mt-4 max-w-lg font-mono text-[11px] text-red-600 opacity-70">{error.message}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/20 bg-mist px-4 py-2 font-body text-sm font-medium text-ink transition hover:border-ink/40"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-signal px-4 py-2 font-display text-sm font-bold text-ink transition hover:bg-signal/90"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
