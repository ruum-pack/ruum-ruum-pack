"use client";
import { useEffect } from "react";
import { EstadoError } from "./EstadoError";
import { recordOperationalEvent } from "../lib/observability";

export default function ErrorGlobalConductor({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void recordOperationalEvent("native_crash", { scope: "global", digest: error.digest ?? "sin-digest", message: error.message.slice(0, 240) }, "error");
    try {
      const w = window as unknown as { Sentry?: { captureException: (e: unknown) => void } };
      w.Sentry?.captureException(error);
    } catch {}
    console.error("[app-conductor/error]", { digest: error.digest ?? "sin-digest", message: error.message });
  }, [error]);

  return (
    <EstadoError
      titulo="Algo salió mal"
      descripcion="Ocurrió un error inesperado. Puedes recargar esta vista o volver al panel."
      detalle={process.env.NODE_ENV === "development" ? error.message : undefined}
      acciones={[
        { etiqueta: "Recargar", onClick: reset, variant: "primary" },
        { etiqueta: "Ir al panel", href: "/", variant: "quiet" }
      ]}
    />
  );
}
