import type { EstadoTraslado } from "@ruum/shared/types";
import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import { CATEGORIA_POR_ESTADO, type CategoriaEstado } from "../lib/estado-visual";

const ESTILO_POR_CATEGORIA: Record<CategoriaEstado, string> = {
  inicial: "bg-ink-soft/10 text-ink-soft border-ink-soft/20",
  activo: "bg-route-soft text-route-dark border-route/25",
  atencion: "bg-warn-soft text-warn border-warn/35",
  completado: "bg-control-soft text-control border-control/25",
  fallido: "bg-danger-soft text-danger border-danger/25"
};

export interface EstadoBadgeProps {
  estado: EstadoTraslado;
  /** Si es false, muestra solo el indicador de color sin el texto. */
  conTexto?: boolean;
}

export function EstadoBadge({ estado, conTexto = true }: EstadoBadgeProps) {
  const categoria = CATEGORIA_POR_ESTADO[estado];
  const estilo = ESTILO_POR_CATEGORIA[categoria];

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-xs font-semibold ${estilo}`}
    >
      <span
        className={`size-1.5 rounded-full ${categoria === "activo" ? "animate-pulse" : ""}`}
        style={{ backgroundColor: "currentColor" }}
        aria-hidden
      />
      {conTexto && ETIQUETA_ESTADO_TRASLADO[estado]}
    </span>
  );
}
