import type { ReactNode } from "react";

export interface AvisoProps {
  tono?: "info" | "success" | "atencion" | "warning" | "danger" | "error";
  titulo?: string;
  children: ReactNode;
  className?: string;
}

const ESTILOS = {
  info: "border-[var(--ruum-action)]/30 bg-[var(--ruum-action-bg)] text-[var(--ruum-action-text)]",
  success: "border-[var(--ruum-success)]/30 bg-[var(--ruum-success-bg)] text-[var(--ruum-success-text)]",
  atencion: "border-[var(--ruum-warning)]/40 bg-[var(--ruum-warning-bg)] text-[var(--ruum-warning-text)]",
  warning: "border-[var(--ruum-warning)]/40 bg-[var(--ruum-warning-bg)] text-[var(--ruum-warning-text)]",
  danger: "border-[var(--ruum-error)]/30 bg-[var(--ruum-error-bg)] text-[var(--ruum-error-text)]",
  error: "border-[var(--ruum-error)]/30 bg-[var(--ruum-error-bg)] text-[var(--ruum-error-text)]",
} as const;

function IconoAviso({ tono }: { tono: keyof typeof ESTILOS }) {
  const d =
    tono === "success"
      ? "M20 6 9 17l-5-5"
      : tono === "info"
        ? "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 11v5M12 7.5h.01"
        : "M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px] shrink-0">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mensaje semántico con ícono + texto. Nunca solo color. */
export function Aviso({ tono = "info", titulo, children, className = "" }: AvisoProps) {
  const danger = tono === "danger" || tono === "error";
  return (
    <div
      role={danger ? "alert" : "status"}
      className={`flex gap-2.5 rounded-xl border px-4 py-3 font-body text-sm leading-5 shadow-1 ${ESTILOS[tono]} ${className}`}
    >
      <IconoAviso tono={tono} />
      <div className="min-w-0">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
