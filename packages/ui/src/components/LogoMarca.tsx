export interface LogoMarcaProps {
  /** Tamaño en px del ícono cuadrado. */
  tamano?: number;
  /**
   * Color de apoyo para el punto de destino. La ruta y el check permanecen
   * en amarillo ruta, como define el brand book.
   */
  color?: "signal" | "route" | "control";
  /** Conservado por compatibilidad; el símbolo oficial no usa progreso. */
  progreso?: number;
  className?: string;
}

const COLOR_HEX: Record<NonNullable<LogoMarcaProps["color"]>, string> = {
  signal: "#ffc400",
  route: "#1e88e5",
  control: "#08734f"
};

/**
 * Símbolo compacto de Ruum Ruum: monograma RR, ruta amarilla, origen,
 * destino y check de confirmación. Está pensado para avatar, favicon,
 * cabeceras pequeñas y estados donde el logo completo no cabe.
 */
export function LogoMarca({ tamano = 28, color = "signal", className = "" }: LogoMarcaProps) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Ruum Ruum"
      className={className}
    >
      <circle cx="32" cy="32" r="29" fill="var(--color-asphalt)" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="var(--color-signal)" strokeWidth="3" />
      <text
        x="17"
        y="37"
        fill="var(--color-mist)"
        fontFamily="var(--font-display)"
        fontSize="18"
        fontWeight="800"
        letterSpacing="-1"
      >
        RR
      </text>
      <path
        d="M14 44 C22 30 31 49 39 31 C43 23 48 23 52 26"
        fill="none"
        stroke="var(--color-signal)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="14" cy="44" r="4.5" fill="var(--color-asphalt)" stroke="var(--color-signal)" strokeWidth="3" />
      <circle cx="52" cy="26" r="4.5" fill={COLOR_HEX[color]} />
      <path d="M43 43 L50 50 L58 37" fill="none" stroke="var(--color-signal)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
