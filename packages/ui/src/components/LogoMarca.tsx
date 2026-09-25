import type { SVGProps } from "react";

export type LogoVariante = "horizontal" | "vertical" | "simbolo" | "avatar";
export type LogoTema = "oscuro" | "claro" | "monocromatico" | "auto";

export interface LogoMarcaProps {
  /**
   * Variante gráfica del logotipo según Brand Book:
   * - "horizontal": Símbolo RR + Nombre + Descriptor + by MoviliaX (recomendado para web, cabeceras, firmas).
   * - "vertical": Símbolo RR arriba + Nombre + Descriptor + by MoviliaX (portadas, carteles).
   * - "simbolo": Monograma RR con ruta amarilla, origen, destino y check (favicón, stickers, marcas de agua).
   * - "avatar": Monograma RR sobre fondo negro asfalto #151515 (WhatsApp, redes sociales, perfiles).
   */
  variante?: LogoVariante;
  /**
   * Tema de contraste:
   * - "auto": Adaptable automáticamente según el tema activo claro/oscuro (por defecto).
   * - "oscuro": Para fondos oscuros (texto blanco/claro).
   * - "claro": Para fondos claros (texto negro asfalto #151515).
   * - "monocromatico": En un solo tono neutro cuando sea requerido.
   */
  tema?: LogoTema;
  /** Tamaño en px (ancho o alto según la variante). */
  tamano?: number;
  /** Muestra o no el respaldo 'by MoviliaX' (por defecto true en horizontal y vertical). */
  mostrarRespaldo?: boolean;
  /** Muestra o no el descriptor oficial (por defecto true en horizontal y vertical). */
  mostrarDescriptor?: boolean;
  /** Texto personalizado para el descriptor (por defecto 'Conductores certificados'). */
  descriptor?: string;
  /** Subtítulo o lema adicional (por ejemplo '.'). */
  subtitulo?: string;
  /** Color de apoyo opcional para el punto de destino (compatibilidad). */
  color?: "signal" | "route" | "control";
  /** Clases CSS adicionales. */
  className?: string;
  /** Conservado por compatibilidad; el símbolo oficial no usa progreso. */
  progreso?: number;
}

const LOGO_HEADER_SRC = "/imagenes/ruum-logo-header.png";

function ImagenLogoHeader({
  tamano,
  className,
  alt = "Ruum Ruum"
}: {
  tamano: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={LOGO_HEADER_SRC}
      alt={alt}
      width={1195}
      height={389}
      className={`block h-auto w-auto shrink-0 object-contain ${className ?? ""}`}
      style={{ height: `${tamano}px`, width: "auto", maxWidth: "min(68vw, 260px)" }}
      decoding="async"
    />
  );
}

/**
 * Monograma vectorial oficial Ruum Ruum V1.0 (Libro de Marca V2.1 cap. 10):
 * RR entrelazado bold con inclinación + corte central (carretera) + swoosh
 * turquesa 00D1D1 que termina en pin de entrega. Movimiento + Destino + Confianza.
 * El nombre en el logotipo es dibujo vectorial; este SVG es el maestro en código.
 */
export function SimboloVectorial({
  tamano = 36,
  tema = "auto",
  colorDestino = "#00D1D1",
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & {
  tamano?: number;
  tema?: LogoTema;
  colorDestino?: string;
  className?: string;
}) {
  const esClaro = tema === "claro";
  const esMono = tema === "monocromatico";

  const navy = "#0A2342";
  const teal = "#00D1D1";
  const white = "#FFFFFF";
  const colorFondo = esMono
    ? "none"
    : esClaro
      ? white
      : tema === "auto"
        ? "var(--ruum-canvas, #FFFFFF)"
        : navy;
  const colorRR = esMono ? (esClaro ? navy : white) : esClaro ? navy : tema === "auto" ? `var(--ruum-navy, ${navy})` : white;
  const colorSwoosh = esMono ? colorRR : teal;
  const colorPin = esMono ? colorRR : colorDestino;
  const showFondo = !esMono;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Símbolo oficial Ruum Ruum — RR entrelazado con ruta y pin de entrega"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {showFondo && <circle cx="36" cy="36" r="34" fill={colorFondo} />}
      {/* RR entrelazado: bloque bold con inclinación hacia adelante */}
      <g transform="skewX(-6)">
        <text
          x="12"
          y="47"
          fill={colorRR}
          fontFamily="Inter, Arial, sans-serif"
          fontSize="30"
          fontWeight="800"
          letterSpacing="-4"
        >
          RR
        </text>
      </g>
      {/* Corte central = carretera */}
      <path d="M33 12 L39 12 L31 60 L25 60 Z" fill={showFondo ? colorFondo : white} opacity={esMono ? 0 : 1} aria-hidden />
      {/* Swoosh turquesa: ruta en movimiento */}
      <path
        d="M31 8 C 33 22, 40 34, 52 44 C 56 47, 59 49, 61 50"
        fill="none"
        stroke={colorSwoosh}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* Pin de entrega al final de la ruta */}
      <g transform="translate(57, 42)">
        <path
          d="M8 0 a8 8 0 1 0 0.01 0 M8 14.5 L3.5 8.2 a5.2 5.2 0 1 1 9 0 Z"
          fill={colorPin}
        />
        <circle cx="8" cy="8" r="2.6" fill={showFondo ? colorFondo : white} />
      </g>
    </svg>
  );
}

/**
 * Logotipo Principal Ruum Ruum con variantes:
 * - "horizontal": ideal para navegación y documentos.
 * - "vertical": ideal para portadas y carteles.
 * - "simbolo": ícono compacto.
 * - "avatar": formato cuadrado para redes sociales.
 */
export function LogoMarca({
  variante = "horizontal",
  tema = "auto",
  tamano,
  mostrarRespaldo = true,
  mostrarDescriptor = true,
  descriptor,
  subtitulo,
  color = "signal",
  className = ""
}: LogoMarcaProps) {
  const colorDestino = color === "route" ? "#0066FF" : color === "control" ? "#16805A" : "#00D1D1";
  const esClaro = tema === "claro";

  const colorTextoSecundario = esClaro ? "text-[#566889]" : tema === "auto" ? "text-text-secondary" : "text-[#C7D5E7]";
  const colorTextoRespaldo = esClaro ? "text-[#566889]/80" : tema === "auto" ? "text-text-tertiary" : "text-[#A9BCD3]";

  // Símbolo independiente o avatar (cap. 12: símbolo 50-60% ancho, radio ≈24%, sin nombre ni firma)
  if (variante === "simbolo" || variante === "avatar") {
    const tamanoSimbolo = tamano ?? (variante === "avatar" ? 44 : 32);
    return (
      <div
        className={`inline-flex items-center justify-center ${
          variante === "avatar" ? "rounded-[24%] bg-white p-1.5 shadow-md ring-1 ring-black/5" : ""
        } ${className}`}
      >
        <SimboloVectorial tamano={tamanoSimbolo} tema={variante === "avatar" ? "claro" : tema} colorDestino={colorDestino} />
      </div>
    );
  }

  // Versión vertical (centrada)
  if (variante === "vertical") {
    return (
      <div className={`inline-flex flex-col items-center text-center ${className}`}>
        <ImagenLogoHeader tamano={tamano ?? 48} />
        {mostrarDescriptor && descriptor && (
          <span className={`mt-1 font-body text-xs font-semibold uppercase tracking-wider ${colorTextoSecundario}`}>
            {descriptor}
          </span>
        )}
        {subtitulo && (
          <span className={`mt-0.5 block font-body text-[10px] font-medium tracking-wide ${colorTextoSecundario}`}>
            {subtitulo}
          </span>
        )}
      </div>
    );
  }

  // Versión horizontal oficial (por defecto)
  return (
    <div className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <ImagenLogoHeader tamano={tamano ?? 36} />
      {mostrarDescriptor && descriptor && (
        <span className={`shrink-0 font-body text-xs font-semibold ${colorTextoSecundario}`}>
          {descriptor}
        </span>
      )}
      {subtitulo && (
        <span className={`shrink-0 font-body text-[10px] font-medium ${colorTextoSecundario}`}>
          {subtitulo}
        </span>
      )}
      {mostrarRespaldo && !descriptor && (
        <span className={`sr-only ${colorTextoRespaldo}`}>by MoviliaX</span>
      )}
    </div>
  );
}
