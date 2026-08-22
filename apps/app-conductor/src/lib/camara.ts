import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { esNativo } from "./capacitor";

export interface FotoCapturada {
  dataUrl: string;
}

async function obtenerFoto(source: CameraSource): Promise<FotoCapturada | null> {
  if (!esNativo()) return null;

  const foto = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source,
    quality: 75,
    saveToGallery: false,
    // Hallazgo 5.4 — limitar ancho para 10 fotos por traslado en campo con señal variable
    width: 1280,
    height: 1280,
    correctOrientation: true
  });

  if (!foto.dataUrl) return null;
  // Compresión adicional client-side si excede 1280px (ver comprimirDataUrl)
  const dataUrl = await comprimirDataUrl(foto.dataUrl, 1280, 0.72).catch(() => foto.dataUrl!);
  return { dataUrl };
}

/**
 * Comprime un dataUrl JPEG/PNG a max lado 1280px usando canvas. No bloquea el hilo
 * más de ~50ms por foto en gama media. Si falla (dataUrl no es imagen), devuelve original.
 */
export async function comprimirDataUrl(dataUrl: string, maxLado = 1280, calidad = 0.72): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  if (!dataUrl.startsWith("data:image")) return dataUrl;
  // Si ya es pequeño (<600KB aprox), no comprimir
  if (dataUrl.length < 600_000) return dataUrl;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (w <= maxLado && h <= maxLado) return resolve(dataUrl);
      const ratio = Math.min(maxLado / w, maxLado / h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL("image/jpeg", calidad)); } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * PRD §4.4 — captura de evidencia fotográfica. Solo funciona dentro del
 * shell nativo (cámara real vía Capacitor); en navegador devuelve null y la
 * pantalla usa selector de archivo real (input file) — el antiguo "modo dev
 * marcar capturado sin foto" fue retirado.
 */
export async function capturarFoto(): Promise<FotoCapturada | null> {
  return obtenerFoto(CameraSource.Camera);
}

export async function seleccionarFotoGaleria(): Promise<FotoCapturada | null> {
  return obtenerFoto(CameraSource.Photos);
}
