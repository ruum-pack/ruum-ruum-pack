import type { ReactNode } from "react";

/** Alert — feedback con ícono + texto (cap. 19). Los que exigen acción no desaparecen solos. */
export type AlertTono = "success" | "error" | "warning" | "info";

const ESTILOS: Record<AlertTono, string> = {
  success: "border-[var(--ruum-success)]/30 bg-[var(--ruum-success-bg)] text-[var(--ruum-success-text)]",
  error: "border-[var(--ruum-error)]/30 bg-[var(--ruum-error-bg)] text-[var(--ruum-error-text)]",
  warning: "border-[var(--ruum-warning)]/40 bg-[var(--ruum-warning-bg)] text-[var(--ruum-warning-text)]",
  info: "border-[var(--ruum-action)]/30 bg-[var(--ruum-action-bg)] text-[var(--ruum-action-text)]",
};

function Icono({ tono }: { tono: AlertTono }) {
  const d =
    tono === "success"
      ? "M20 6 9 17l-5-5"
      : tono === "error"
        ? "M12 8v5M12 16.5h.01M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"
        : tono === "warning"
          ? "M12 8v5M12 16.5h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z"
          : "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 11v5M12 7.5h.01";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="size-[18px] shrink-0">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface AlertProps {
  tono?: AlertTono;
  titulo?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ tono = "info", titulo, children, className = "" }: AlertProps) {
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={`flex gap-2.5 rounded-[12px] border px-4 py-3 font-body text-sm leading-5 shadow-[var(--ruum-elevation-1)] ${ESTILOS[tono]} ${className}`}
    >
      <Icono tono={tono} />
      <div className="min-w-0">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Toast — variante flotante del Alert. */
export function Toast({ tono = "info", children, className = "" }: AlertProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-[12px] border px-4 py-3 font-body text-sm shadow-[var(--ruum-elevation-2)] ${ESTILOS[tono]} ${className}`}
    >
      <Icono tono={tono} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
