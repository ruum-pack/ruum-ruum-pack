"use client";

import { EstadoError } from "../EstadoError";

export default function ErrorViajes({ reset }: { reset: () => void }) {
  return (
    <EstadoError
      titulo="No pudimos cargar tus viajes"
      descripcion="Falla de conexión. Revisa tu señal, recarga la vista o vuelve a tu lista de viajes."
      acciones={[
        { etiqueta: "Ver mis viajes", href: "/viajes", variant: "primario" },
        { etiqueta: "Volver al panel", href: "/", variant: "fantasma" },
        { etiqueta: "Recargar", onClick: reset, variant: "secundario" }
      ]}
    />
  );
}
