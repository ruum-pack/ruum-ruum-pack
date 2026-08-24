"use client";

import { useEffect } from "react";
import { EstadoError } from "../EstadoError";
import { recordOperationalEvent } from "../../lib/observability";

export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void recordOperationalEvent("native_crash", { scope: "panel", digest: error.digest ?? "sin-digest", message: error.message.slice(0, 240) }, "error");
    try {
      const w = window as unknown as { Sentry?: { captureException: (e: unknown) => void } };
      w.Sentry?.captureException(error);
    } catch {}
    console.error("[panel/error]", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <EstadoError
      titulo="No pudimos cargar el panel"
      descripcion="Falla temporal al cargar tu información operativa. Reintenta — tus viajes activos no se pierden."
      detalle={process.env.NODE_ENV === "development" ? error.message : undefined}
      acciones={[
        { etiqueta: "Reintentar", onClick: reset, variant: "primary" },
        { etiqueta: "Ver viajes", href: "/viajes", variant: "secondary" },
        { etiqueta: "Recargar app", onClick: () => window.location.reload(), variant: "quiet" },
      ]}
    />
  );
}
