"use client";

import { useEffect } from "react";
import { EstadoError } from "./EstadoError";

export default function ErrorGlobalConductor({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-conductor/error]", error);
  }, [error]);

  return (
    <EstadoError
      titulo="Algo salió mal"
      descripcion="Ocurrió un error inesperado. Puedes recargar esta vista o volver al panel."
      detalle={process.env.NODE_ENV === "development" ? error.message : undefined}
      acciones={[
        { etiqueta: "Recargar", onClick: reset, variant: "primario" },
        { etiqueta: "Ir al panel", href: "/", variant: "fantasma" }
      ]}
    />
  );
}
