import type { SVGProps } from "react";

export type SelloTema = "dorado" | "oscuro" | "claro";
export type SelloTamano = "sm" | "md" | "lg";

export interface SelloConductorProps {
  /** Tema visual del sello */
  tema?: SelloTema;
  /** Tamaño del sello */
  tamano?: SelloTamano | number;
  /** Variante compacta (badge con escudo) o completa (emblema perimetral) */
  compacto?: boolean;
  /** Frase secundaria (por defecto 'Seguridad · Evidencia · Trazabilidad') */
  lema?: string;
  className?: string;
}

const TAMANOS: Record<SelloTamano, number> = {
  sm: 48,
  md: 80,
  lg: 120
};

/**
 * Sello Oficial de Conductor Certificado Ruum Ruum
 * Conforme a la Página 12 del Brand Book Ruum Ruum V1.
 * Respalda visualmente el sistema de validación, pruebas y protocolos de conductores.
 */
export function SelloConductor({
  tema = "dorado",
  tamano = "md",
  compacto = false,
  lema = "Seguridad · Evidencia · Trazabilidad",
  className = ""
}: SelloConductorProps) {
  const dimension = typeof tamano === "number" ? tamano : TAMANOS[tamano];

  const esDorado = tema === "dorado";
  const esClaro = tema === "claro";

  const fondo = esDorado ? "#151515" : esClaro ? "#F8F8F5" : "#151515";
  const borde = esDorado ? "#FFC400" : esClaro ? "#151515" : "#FFC400";
  const acento = "#FFC400";
  const textoColor = esClaro ? "#151515" : "#FFFFFF";

  if (compacto) {
    return (
      <div
        className={`inline-flex items-center gap-2.5 rounded-lg border px-3 py-1.5 ${
          esClaro ? "border-[#5F6368]/30 bg-[#F8F8F5] text-[#151515]" : "border-[#FFC400]/40 bg-[#151515] text-white"
        } ${className}`}
        role="img"
        aria-label="Conductor Certificado Ruum Ruum"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path
            d="M12 2L4 5V11C4 16.55 7.41 21.74 12 23C16.59 21.74 20 16.55 20 11V5L12 2Z"
            fill={acento}
            fillOpacity="0.2"
            stroke={acento}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 11.5L11 13.5L15 9.5"
            stroke={acento}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-[#FFC400]">
            Conductor Certificado
          </span>
          <span className="font-body text-[10px] font-medium tracking-tight opacity-80">
            Ruum Ruum by MoviliaX
          </span>
        </div>
      </div>
    );
  }

  // Versión oficial de emblema perimetral
  const idPath = "sello-texto-perimetral";

  return (
    <div
      className={`inline-flex flex-col items-center justify-center ${className}`}
      role="img"
      aria-label="Sello Oficial Conductor Certificado Ruum Ruum"
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md"
      >
        {/* Fondo institucional */}
        <circle cx="80" cy="80" r="76" fill={fondo} stroke={borde} strokeWidth="3.5" />
        <circle cx="80" cy="80" r="69" fill="none" stroke={acento} strokeWidth="1.2" strokeDasharray="4 3" />

        {/* Ruta circular para el texto perimetral superior */}
        <defs>
          <path
            id={idPath}
            d="M 24 80 A 56 56 0 1 1 136 80"
            fill="none"
          />
        </defs>

        <text fill={acento} fontSize="10.5" fontFamily="Montserrat, sans-serif" fontWeight="800" letterSpacing="2.5">
          <textPath href={`#${idPath}`} startOffset="50%" textAnchor="middle">
            CONDUCTOR CERTIFICADO
          </textPath>
        </text>

        {/* Escudo central */}
        <g transform="translate(56, 46)">
          <path
            d="M24 4L8 10V22C8 33.1 14.82 43.48 24 46C33.18 43.48 40 33.1 40 22V10L24 4Z"
            fill={acento}
            fillOpacity="0.18"
            stroke={acento}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Check de confirmación */}
          <path
            d="M17 23L22 28L31 19"
            fill="none"
            stroke={acento}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Texto central inferior */}
        <text
          x="80"
          y="112"
          fill={textoColor}
          fontFamily="Montserrat, sans-serif"
          fontSize="12"
          fontWeight="800"
          letterSpacing="1"
          textAnchor="middle"
        >
          RUUM RUUM
        </text>

        <text
          x="80"
          y="126"
          fill={acento}
          fontFamily="Inter, sans-serif"
          fontSize="7.5"
          fontWeight="600"
          letterSpacing="0.8"
          textAnchor="middle"
        >
          by MoviliaX
        </text>

        {/* Puntos decorativos */}
        <circle cx="28" cy="80" r="2.5" fill={acento} />
        <circle cx="132" cy="80" r="2.5" fill={acento} />
      </svg>
      {lema && (
        <span className="mt-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-[#5F6368]">
          {lema}
        </span>
      )}
    </div>
  );
}
