import type { ReactNode } from "react";

export interface PassportCardProps {
  children: ReactNode;
  /** Folio o identificador corto a mostrar en la esquina, estilo sello. */
  folio?: string;
  className?: string;
}

/**
 * Tarjeta con una esquina doblada, como un documento sellado. Es el
 * contenedor base para todo lo relacionado con el Pasaporte Digital de
 * Traslado (PRD §5.1): tarjetas de traslado, resúmenes de cotización,
 * comprobantes de pago.
 */
export function PassportCard({ children, folio, className = "" }: PassportCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-card border border-ink/10 bg-mist shadow-[0_1px_0_rgba(20,24,31,0.04)] ${className}`}
    >
      {folio && (
        <div
          className="absolute right-0 top-0 flex h-10 w-10 items-start justify-end overflow-hidden"
          aria-hidden
        >
          <div className="absolute right-[-20px] top-[-20px] h-10 w-10 rotate-45 bg-signal" />
        </div>
      )}
      {folio && (
        <span className="absolute right-2.5 top-2.5 font-mono-ruum text-[10px] tracking-wide text-mist">
          {folio}
        </span>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
