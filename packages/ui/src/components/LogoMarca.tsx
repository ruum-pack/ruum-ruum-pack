import type { SVGProps } from "react";

export type LogoVariante = "horizontal" | "vertical" | "simbolo" | "avatar";
export type LogoTema = "oscuro" | "claro" | "monocromatico";

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
  /** Texto personalizado para el descriptor (por defecto 'Traslado vehicular con conductores certificados'). */
  descriptor?: string;
  /** Subtítulo o lema adicional (por ejemplo 'Tu operación, tu control.'). */
  subtitulo?: string;
  /** Color de apoyo opcional para el punto de destino (compatibilidad). */
  color?: "signal" | "route" | "control";
  /** Clases CSS adicionales. */
  className?: string;
  /** Conservado por compatibilidad; el símbolo oficial no usa progreso. */
  progreso?: number;
}

/**
 * Monograma vectorial oficial Ruum Ruum:
 * Símbolo RR + Línea amarilla de ruta (#FFC400) + Punto de origen + Punto de destino + Check de confirmación.
 */
export function SimboloVectorial({
  tamano = 36,
  tema = "oscuro",
  colorDestino = "#FFC400",
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

  const colorFondo = esClaro ? "#F8F8F5" : "#151515";
  const colorBorde = esMono ? (esClaro ? "#151515" : "#F8F8F5") : "#FFC400";
  const colorLetras = esMono ? (esClaro ? "#151515" : "#F8F8F5") : esClaro ? "#151515" : "#FFFFFF";
  const colorRuta = esMono ? (esClaro ? "#151515" : "#F8F8F5") : "#FFC400";
  const colorPuntoFin = esMono ? (esClaro ? "#151515" : "#F8F8F5") : colorDestino;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Símbolo oficial Ruum Ruum"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {/* Fondo circular institucional */}
      <circle cx="32" cy="32" r="30" fill={colorFondo} />
      <circle cx="32" cy="32" r="28" stroke={colorBorde} strokeWidth="2.5" strokeOpacity={esMono ? "1" : "0.9"} />

      {/* Monograma RR institucional */}
      <text
        x="15"
        y="38"
        fill={colorLetras}
        fontFamily="Montserrat, system-ui, sans-serif"
        fontSize="19"
        fontWeight="800"
        letterSpacing="-1.5"
      >
        RR
      </text>

      {/* Ruta amarilla que cruza el monograma */}
      <path
        d="M13 46 C 22 30, 31 50, 40 32 C 44 24, 48 24, 52 27"
        fill="none"
        stroke={colorRuta}
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Punto de origen */}
      <circle cx="13" cy="46" r="4" fill={colorFondo} stroke={colorRuta} strokeWidth="2.5" />

      {/* Punto de destino */}
      <circle cx="52" cy="27" r="4" fill={colorPuntoFin} stroke={colorFondo} strokeWidth="1.5" />

      {/* Check de confirmación y entrega */}
      <path
        d="M42 44 L48 50 L56 38"
        fill="none"
        stroke={colorRuta}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
  tema = "oscuro",
  tamano,
  mostrarRespaldo = true,
  mostrarDescriptor = true,
  descriptor,
  subtitulo,
  color = "signal",
  className = ""
}: LogoMarcaProps) {
  const colorDestino = color === "route" ? "#1E88E5" : color === "control" ? "#08734F" : "#FFC400";
  const esClaro = tema === "claro";

  const colorTextoTitulo = esClaro ? "text-[#151515]" : "text-white";
  const colorTextoAcento = "text-[#FFC400]";
  const colorTextoSecundario = esClaro ? "text-[#5F6368]" : "text-[#B7C2D4]";
  const colorTextoRespaldo = esClaro ? "text-[#5F6368]/80" : "text-white/45";

  // Símbolo independiente o avatar
  if (variante === "simbolo" || variante === "avatar") {
    const tamanoSimbolo = tamano ?? (variante === "avatar" ? 44 : 32);
    return (
      <div
        className={`inline-flex items-center justify-center ${
          variante === "avatar" ? "rounded-xl bg-[#151515] p-1.5 shadow-md" : ""
        } ${className}`}
        aria-label="Ruum Ruum"
      >
        <SimboloVectorial tamano={tamanoSimbolo} tema={variante === "avatar" ? "oscuro" : tema} colorDestino={colorDestino} />
      </div>
    );
  }

  // Versión vertical (centrada)
  if (variante === "vertical") {
    const tamanoSimbolo = tamano ?? 48;
    return (
      <div className={`inline-flex flex-col items-center text-center ${className}`} aria-label="Ruum Ruum by MoviliaX">
        <SimboloVectorial tamano={tamanoSimbolo} tema={tema} colorDestino={colorDestino} />
        <div className="mt-2.5">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className={`font-display text-2xl font-black tracking-tight ${colorTextoTitulo}`}>Ruum</span>
            <span className={`font-display text-2xl font-black tracking-tight ${colorTextoAcento}`}>Ruum</span>
          </div>
          {mostrarDescriptor && (
            <p className={`mt-1 font-body text-xs font-semibold uppercase tracking-wider ${colorTextoSecundario}`}>
              {descriptor ?? "Traslado vehicular con conductores certificados"}
            </p>
          )}
          {subtitulo && (
            <span className={`mt-0.5 block font-body text-[10px] font-medium tracking-wide ${colorTextoSecundario}`}>
              {subtitulo}
            </span>
          )}
          {mostrarRespaldo && (
            <span className={`mt-0.5 block font-body text-[10px] font-medium tracking-widest ${colorTextoRespaldo}`}>
              by MoviliaX
            </span>
          )}
        </div>
      </div>
    );
  }

  // Versión horizontal oficial (por defecto)
  const tamanoSimbolo = tamano ?? 36;
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} aria-label="Ruum Ruum by MoviliaX">
      <SimboloVectorial tamano={tamanoSimbolo} tema={tema} colorDestino={colorDestino} />
      <div className="flex flex-col justify-center leading-tight">
        <div className="flex items-baseline gap-1">
          <span className={`font-display text-xl font-black tracking-tight ${colorTextoTitulo}`}>Ruum</span>
          <span className={`font-display text-xl font-black tracking-tight ${colorTextoAcento}`}>Ruum</span>
        </div>
        {mostrarDescriptor && (
          <span className={`font-body text-[11px] font-semibold leading-none tracking-normal ${colorTextoSecundario}`}>
            {descriptor ?? "Traslado vehicular con conductores certificados"}
          </span>
        )}
        {subtitulo && (
          <span className={`mt-0.5 font-body text-[10px] font-medium leading-none ${colorTextoSecundario}`}>
            {subtitulo}
          </span>
        )}
        {mostrarRespaldo && (
          <span className={`mt-0.5 font-body text-[9px] font-medium leading-none tracking-wider ${colorTextoRespaldo}`}>
            by MoviliaX
          </span>
        )}
      </div>
    </div>
  );
}
