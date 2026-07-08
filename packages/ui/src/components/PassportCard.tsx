import type { ReactNode } from "react";

export interface PassportCardProps {
  children: ReactNode;
  /** Folio o identificador corto a mostrar en la esquina, estilo sello. */
  folio?: string;
  /** Acento de prioridad para métricas y elementos que requieren atención visual. */
  acento?: boolean;
  className?: string;
}

/**
 * Tarjeta base del Pasaporte Digital y superficies operativas.
 * Funciona en las tres apps para que los datos, estados y acciones se lean
 * igual, sin importar el rol del usuario.
 */
export function PassportCard({ children, folio, acento = false, className = "" }: PassportCardProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-card border border-ink/15 bg-mist shadow-[0_1px_2px_rgba(26,31,46,0.08)]",
        "transition-[border-color,box-shadow,transform] duration-200",
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
        <span className="absolute right-2.5 top-2.5 font-mono-ruum text-[10px] font-medium tracking-wide text-ink">
          {folio}
        </span>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
