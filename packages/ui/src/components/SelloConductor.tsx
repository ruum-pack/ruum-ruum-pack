import { SimboloVectorial } from "./LogoMarca";

export type SelloTema = "certificado" | "dorado" | "oscuro" | "claro";
export type SelloTamano = "sm" | "md" | "lg";

export interface SelloConductorProps {
  /** Tema visual. "certificado" (navy/teal V1.0) es el vigente; "dorado" se conserva por compatibilidad. */
  tema?: SelloTema;
  tamano?: SelloTamano | number;
  compacto?: boolean;
  lema?: string;
  className?: string;
}

const TAMANOS: Record<SelloTamano, number> = {
  sm: 48,
  md: 80,
  lg: 120,
};

/**
 * Sello de Conductor Certificado V1.0 (cap. 12).
 * Regla: el símbolo RR solo YA ES el sello, no requiere anillo de texto.
 * Solo conductores con certificación vigente. Nivel en chip separado. Mínimo 72px / 24mm.
 */
export function SelloConductor({
  tema = "certificado",
  tamano = "md",
  compacto = false,
  lema = "Seguridad · Evidencia · Trazabilidad",
  className = "",
}: SelloConductorProps) {
  const dimension = Math.max(typeof tamano === "number" ? tamano : TAMANOS[tamano], 32);
  const esDorado = tema === "dorado";

  if (compacto) {
    return (
      <div
        className={`inline-flex items-center gap-2.5 rounded-[12px] border border-[var(--ruum-teal-deep)]/40 bg-white px-3 py-1.5 text-[var(--ruum-navy)] ${className}`}
        role="img"
        aria-label="Conductor certificado Ruum Ruum"
      >
        <SimboloVectorial tamano={28} tema="claro" colorDestino={esDorado ? "#F5B400" : "#00D1D1"} />
        <div className="flex flex-col leading-tight">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-[var(--ruum-teal-deep)]">
            Conductor certificado
          </span>
          <span className="font-body text-[10px] font-medium opacity-80">Ruum Ruum by MoviliaX</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`} role="img" aria-label="Sello conductor certificado Ruum Ruum">
      <SimboloVectorial tamano={dimension} tema={tema === "claro" ? "claro" : tema === "oscuro" ? "oscuro" : "claro"} colorDestino={esDorado ? "#F5B400" : "#00D1D1"} />
      {lema ? (
        <span className="mt-1.5 text-center font-body text-[10px] font-semibold uppercase tracking-wider text-[var(--ruum-muted)]">
          {lema}
        </span>
      ) : null}
    </div>
  );
}
