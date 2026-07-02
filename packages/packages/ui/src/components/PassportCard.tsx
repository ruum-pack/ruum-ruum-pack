import type { ReactNode } from "react";

export interface PassportCardProps {
  children: ReactNode;
  /** Folio o identificador corto a mostrar en la esquina, estilo sello. */
  folio?: string;
  /**
   * Muestra un acento de color en el borde izquierdo en signal (amarillo).
   * Usado para metric-cards del dashboard que necesitan énfasis visual.
   */
  acento?: boolean;
  className?: string;
}

/**
 * Tarjeta base para el Pasaporte Digital de Traslado (PRD §5.1).
 * Fondo blanco, borde sutil, esquinas redondeadas.
 * Con `acento` activo, agrega barra izquierda en signal (amarillo dorado)
 * — firma visual de las métricas clave en la Torre de Control.
 */
export function PassportCard({ children, folio, acento = false, className = "" }: PassportCardProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-card border border-steel/20 bg-mist shadow-sm",
        acento ? "border-l-4 border-l-signal" : "",
        className
      ].join(" ")}
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
        <span className="absolute right-2.5 top-2.5 font-mono-ruum text-[10px] tracking-wide text-ink">
          {folio}
        </span>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
