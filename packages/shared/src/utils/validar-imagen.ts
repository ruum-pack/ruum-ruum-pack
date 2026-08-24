/**
 * Obtiene las dimensiones (ancho y alto) de un Blob/File de imagen.
 * Si el archivo no es imagen o el entorno no soporta decodificación visual, retorna null.
 */
export async function obtenerDimensionesImagen(
  archivo: Blob
): Promise<{ width: number; height: number } | null> {
  if (!archivo.type || !archivo.type.startsWith("image/")) {
    return null;
  }

  // Soporte createImageBitmap (moderno y eficiente)
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(archivo);
      const dimensiones = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensiones;
    } catch {
      // Si falla decodificación con bitmap, intenta con elemento Image
    }
  }

  // Fallback con HTMLImageElement en navegador
  if (typeof window !== "undefined" && typeof window.Image === "function" && typeof URL !== "undefined") {
    return new Promise((resolve) => {
      let objectUrl: string | null = null;
      try {
        objectUrl = URL.createObjectURL(archivo);
      } catch {
        return resolve(null);
      }

      const img = new window.Image();
      img.onload = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      img.src = objectUrl;
    });
  }

  return null;
}

export interface ResultadoValidacionDimensiones {
  valido: boolean;
  ancho?: number;
  alto?: number;
  error?: string;
}

/**
 * Valida que una imagen cumpla con una resolución mínima requerida.
 */
export async function validarDimensionesMinimasImagen(
  archivo: Blob,
  minAncho = 300,
  minAlto = 300
): Promise<ResultadoValidacionDimensiones> {
  const dimensiones = await obtenerDimensionesImagen(archivo);
  if (!dimensiones) {
    // Si no es imagen (ej. PDF) o no se puede medir en el entorno actual, pasa como válido
    return { valido: true };
  }

  if (dimensiones.width < minAncho || dimensiones.height < minAlto) {
    return {
      valido: false,
      ancho: dimensiones.width,
      alto: dimensiones.height,
      error: `La imagen debe tener una resolución mínima de ${minAncho}x${minAlto} píxeles (actual: ${dimensiones.width}x${dimensiones.height}px).`
    };
  }

  return {
    valido: true,
    ancho: dimensiones.width,
    alto: dimensiones.height
  };
}
