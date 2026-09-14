import Image from "next/image";
import type { CSSProperties, SyntheticEvent } from "react";

export interface MapaEstaticoProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void;
  style?: CSSProperties;
  /** Dimensiones fijas (miniaturas). Sin ellas usa `fill`: el padre debe ser `relative` con caja definida. */
  width?: number;
  height?: number;
}

/**
 * Imagen remota/estática con `next/image` para mapas y evidencias.
 * - `http(s)`: optimizada (remotePatterns centralizados en next.config).
 * - `blob:`/`data:` (previews offline): `unoptimized` (el optimizador no los acepta).
 */
export function MapaEstatico({
  src,
  alt,
  className,
  sizes,
  eager,
  onLoad,
  style,
  width,
  height
}: MapaEstaticoProps) {
  const local = src.startsWith("blob:") || src.startsWith("data:");
  const fijo = width != null && height != null;
  return (
    <Image
      src={src}
      alt={alt}
      {...(fijo ? { width, height } : { fill: true })}
      sizes={fijo ? undefined : (sizes ?? "(max-width: 767px) 100vw, 800px")}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      unoptimized={local}
      className={className}
      style={style}
      onLoad={onLoad}
    />
  );
}
