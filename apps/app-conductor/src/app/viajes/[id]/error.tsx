"use client";

import { useEffect } from "react";
import Link from "next/link";
import { recordOperationalEvent } from "../../../lib/observability";

export default function ErrorDetalleViaje({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void recordOperationalEvent("native_crash", { scope: "viaje-detalle", digest: error.digest ?? "sin-digest", message: error.message.slice(0, 240) }, "error");
    try {
      const w = window as unknown as { Sentry?: { captureException: (e: unknown) => void } };
      w.Sentry?.captureException(error);
    } catch {}
    console.error("[viaje-detalle/error]", error);
  }, [error]);

  return (
    <div className="conductor-content flex min-h-[50vh] flex-col items-center justify-center text-center" role="alert">
      <h1 className="font-display text-xl font-semibold">Error al cargar este viaje</h1>
      <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
        No pudimos obtener los datos del traslado. Puede ser una falla temporal de conexión.
      </p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-surface-elevated p-3 text-left font-mono text-xs text-danger/80 border border-danger/20">{error.message}</pre>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary transition hover:border-border-strong">
          Reintentar
        </button>
        <Link href="/viajes" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-2.5 font-display text-sm font-bold text-text-primary transition hover:bg-signal/90">
          Ver mis viajes
        </Link>
        <Link href="/panel" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary">
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
