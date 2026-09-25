import type { EstadoTraslado } from "@ruum/shared/types";
import { ETIQUETA_ESTADO_TRASLADO } from "@ruum/shared/states";
import { CATEGORIA_POR_ESTADO, type CategoriaEstado } from "./estado-visual";

const ESTILO_POR_CATEGORIA: Record<CategoriaEstado, string> = {
  inicial: "bg-[var(--ruum-neutral-bg)] text-[var(--ruum-neutral-text)] border-[var(--ruum-border)]",
  activo: "bg-[var(--ruum-action-bg)] text-[var(--ruum-action-text)] border-[var(--ruum-action)]/30",
  atencion: "bg-[var(--ruum-warning-bg)] text-[var(--ruum-warning-text)] border-[var(--ruum-warning)]/40",
  completado: "bg-[var(--ruum-success-bg)] text-[var(--ruum-success-text)] border-[var(--ruum-success)]/30",
  fallido: "bg-[var(--ruum-error-bg)] text-[var(--ruum-error-text)] border-[var(--ruum-error)]/30"
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
