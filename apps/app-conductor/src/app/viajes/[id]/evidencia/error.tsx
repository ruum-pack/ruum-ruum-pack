"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { recordOperationalEvent } from "../../../../lib/observability";

export default function ErrorEvidencia({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    void recordOperationalEvent("evidence_stuck", { scope: "evidencia", trasladoId: id, digest: error.digest ?? "sin-digest", message: error.message.slice(0, 240) }, "error");
    try {
      const w = window as unknown as { Sentry?: { captureException: (e: unknown) => void } };
      w.Sentry?.captureException(error);
    } catch {}
    console.error("[evidencia/error]", { id, digest: error.digest, message: error.message });
  }, [error, id]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <div className="rounded-2xl border border-border/40 bg-surface p-6 shadow-sm w-full">
        <h1 className="font-display text-lg font-black text-text-primary">No pudimos cargar la evidencia</h1>
        <p className="mt-2 font-body text-sm leading-6 text-text-secondary">
          Falla al cargar fotos o checklist. Tus fotos en cola offline están seguras — reintenta cuando tengas señal.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="mt-3 max-h-24 overflow-auto rounded-lg bg-surface-elevated p-3 text-left font-mono text-xs text-danger/80 border border-danger/20">{error.message}</pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-signal/90"
          >
            Reintentar
          </button>
          <Link href={`/viajes/${id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary">
            Volver al viaje
          </Link>
          <Link href="/viajes" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 py-2.5 font-body text-sm font-medium text-text-primary">
            Ver viajes
          </Link>
        </div>
        <p className="mt-4 font-body text-xs text-text-tertiary">Si el error persiste, la cola se sincronizará al recuperar conexión. No recaptures.</p>
      </div>
    </div>
  );
}
