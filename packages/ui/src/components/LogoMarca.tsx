export interface LogoMarcaProps {
  /** Tamaño en px del ícono cuadrado. */
  tamano?: number;
  /**
   * Color del arco activo. Por defecto signal (acción/conductor), pero cada
   * app lee el anillo distinto: app-usuario lo usa en route (avance del
   * Pasaporte que el cliente sigue), panel-admin en control (salud agregada
   * de la flota). Ver propuesta de identidad, 2026-06-29.
   */
  color?: "signal" | "route" | "control";
  /** Proporción del anillo que aparece "llena" (0 a 1). Puramente decorativo por defecto. */
  progreso?: number;
  className?: string;
}

const COLOR_HEX: Record<NonNullable<LogoMarcaProps["color"]>, string> = {
  signal: "#ff4d1d",
  route: "#1758f2",
  control: "#16b378"
};

/**
 * El elemento de firma de la marca: un anillo segmentado que representa el
 * avance del Pasaporte Digital de Traslado. No es un ícono de auto, ruta o
 * pin de mapa — es deliberadamente abstracto para no leerse como una
 * empresa de transporte tradicional. Funciona como ícono de marca, como
 * loader, y como medidor de estatus, según el contexto en el que se use.
 */
export function LogoMarca({ tamano = 28, color = "signal", progreso = 0.62, className = "" }: LogoMarcaProps) {
  const radio = 22;
  const circunferencia = 2 * Math.PI * radio;
  const arco = Math.max(0, Math.min(1, progreso)) * circunferencia;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Ruum Ruum"
      className={className}
    >
      <circle cx="32" cy="32" r="28" fill="var(--color-ink)" />
      <circle cx="32" cy="32" r={radio} fill="none" stroke="var(--color-ink-soft)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={radio}
        fill="none"
        stroke={COLOR_HEX[color]}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${arco} ${circunferencia}`}
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}
