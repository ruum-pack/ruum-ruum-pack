import * as React from "react";
import type { ReactNode } from "react";
import type { EstadoVisualTraslado } from "./status-mapping";

export type TonoChip = "neutro" | "accion" | "pendiente" | "exito" | "error" | "emergencia";

interface MetaChip {
  etiqueta: string;
  tono: TonoChip;
  icono: ReactNode;
}

function Icono({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="size-3.5 shrink-0">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const D = {
  reloj: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  recibo: "M6 2h12v20l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6",
  id: "M3 5h18v14H3zM7 10h4M7 14h7M17 10v4",
  camara: "M4 8h3l2-2h6l2 2h3v11H4ZM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  nav: "M3 11 22 2l-9 19-2-8ZM22 2 11 13",
  check: "M20 6 9 17l-5-5",
  doc: "M6 2h9l5 5v15H6ZM14 2v6h6",
  sirena: "M12 3v4M5 5l2.5 2.5M19 5l-2.5 2.5M4 13h16a8 8 0 0 1-16 0ZM10 21h4",
  x: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9 9l6 6M15 9l-6 6",
  billete: "M3 7h18v10H3zM7 11h4M7 14h7M17 11v3",
};

const META: Record<EstadoVisualTraslado, MetaChip> = {
  solicitado: { etiqueta: "Solicitado", tono: "neutro", icono: <Icono d={D.reloj} /> },
  "cotizacion-confirmada": { etiqueta: "Cotización confirmada", tono: "accion", icono: <Icono d={D.recibo} /> },
  "pendiente-conductor": { etiqueta: "Pendiente de conductor", tono: "pendiente", icono: <Icono d={D.reloj} /> },
  "conductor-asignado": { etiqueta: "Conductor asignado", tono: "accion", icono: <Icono d={D.id} /> },
  "evidencia-inicial-completa": { etiqueta: "Evidencia inicial completa", tono: "exito", icono: <Icono d={D.camara} /> },
  "en-ruta": { etiqueta: "En ruta", tono: "accion", icono: <Icono d={D.nav} /> },
  "entrega-confirmada": { etiqueta: "Entrega confirmada", tono: "exito", icono: <Icono d={D.check} /> },
  cerrado: { etiqueta: "Cerrado", tono: "neutro", icono: <Icono d={D.doc} /> },
  "evidencia-pendiente": { etiqueta: "Evidencia pendiente", tono: "pendiente", icono: <Icono d={D.camara} /> },
  "incidente-abierto": { etiqueta: "Incidente abierto", tono: "emergencia", icono: <Icono d={D.sirena} /> },
  cancelado: { etiqueta: "Cancelado", tono: "error", icono: <Icono d={D.x} /> },
  "pago-detenido": { etiqueta: "Pago detenido", tono: "pendiente", icono: <Icono d={D.billete} /> },
};

const ESTILO_POR_TONO: Record<TonoChip, string> = {
  neutro: "bg-[var(--ruum-neutral-bg)] text-[var(--ruum-neutral-text)] border-[var(--ruum-border)]",
  accion: "bg-[var(--ruum-action-bg)] text-[var(--ruum-action-text)] border-[var(--ruum-action)]/30",
  pendiente: "bg-[var(--ruum-warning-bg)] text-[var(--ruum-warning-text)] border-[var(--ruum-warning)]/40",
  exito: "bg-[var(--ruum-success-bg)] text-[var(--ruum-success-text)] border-[var(--ruum-success)]/30",
  error: "bg-[var(--ruum-error-bg)] text-[var(--ruum-error-text)] border-[var(--ruum-error)]/30",
  emergencia: "bg-[var(--ruum-emergency-bg)] text-[var(--ruum-emergency-text)] border-[var(--ruum-emergency)]/40",
};

export interface StatusChipProps {
  estado: EstadoVisualTraslado;
  className?: string;
}

/** Chip de estado con ícono + texto. Contraste ≥4.5:1. */
export function StatusChip({ estado, className = "" }: StatusChipProps) {
  const meta = META[estado];
  return (
    <span
      role="status"
      className={`inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-xs font-semibold leading-4 ${ESTILO_POR_TONO[meta.tono]} ${className}`}
    >
      {meta.icono}
      {meta.etiqueta}
    </span>
  );
}
