import type { ReactNode } from "react";

export interface PassportCardProps {
  children: ReactNode;
  /** Folio o identificador corto a mostrar en la esquina, estilo sello. */
  folio?: string;
  /** Acento documental para registros que requieren atención visual. */
  acento?: boolean;
  /** Permite contenido sticky o overlays que deben sobresalir de la tarjeta. */
  clip?: boolean;
  className?: string;
}

/** Tarjeta exclusiva para identidad, expediente, documentación y pasaporte digital. */
export function PassportCard({ children, folio, acento = false, clip = true, className = "" }: PassportCardProps) {
  return (
    <div
      className={[
        "relative rounded-card border border-border bg-surface shadow-1",
        clip ? "overflow-hidden" : "",
        "transition-[border-color,box-shadow,transform] duration-200",
        acento ? "border-l-4 border-l-action-primary" : "",
        className
      ].join(" ")}
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 w-full text-text-tertiary opacity-20"
        viewBox="0 0 420 160"
        preserveAspectRatio="none"
      >
        <path
          d="M-20 112C38 58 82 58 140 112s102 54 160 0 102-54 160 0M-20 86C38 32 82 32 140 86s102 54 160 0 102-54 160 0M-20 138C38 84 82 84 140 138s102 54 160 0 102-54 160 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
      {folio && (
        <div
          className="absolute right-0 top-0 flex h-10 w-10 items-start justify-end overflow-hidden"
          aria-hidden
        >
          <div className="absolute right-[-20px] top-[-20px] h-10 w-10 rotate-45 bg-action-primary" />
        </div>
      )}
      {folio && (
        <span className="absolute right-2.5 top-2.5 font-mono-ruum text-xs font-medium tracking-wide text-text-primary">
          {folio}
        </span>
      )}
      <div className="relative p-5 sm:p-6">{children}</div>
    </div>
  );
}
