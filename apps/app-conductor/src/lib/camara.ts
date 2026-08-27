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

/**
 * M3 — Detección de borrosidad / oscuridad antes de encolar (90s flow).
 * Calcula varianza de Laplaciano sobre una versión 100×100 en escala de grises.
 * Devuelve true si es nítida (varianza > umbral). Umbral 120 calibrado para móviles gama media.
 * No bloquea >40ms en gama media.
 */
export async function evaluarNitidez(dataUrl: string, umbral = 120): Promise<{ nitida: boolean; varianza: number; motivo?: string }> {
  if (typeof document === "undefined") return { nitida: true, varianza: 999 };
  if (!dataUrl.startsWith("data:image")) return { nitida: true, varianza: 999 };
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true } as unknown as CanvasRenderingContext2DSettings);
        if (!ctx) return resolve({ nitida: true, varianza: 999 });
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        // Grayscale + brillo medio
        let brillo = 0;
        const gray = new Float32Array(size * size);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          gray[p] = g;
          brillo += g;
        }
        brillo /= gray.length;
        if (brillo < 35) return resolve({ nitida: false, varianza: 0, motivo: "muy_oscura" });
        if (brillo > 245) return resolve({ nitida: false, varianza: 0, motivo: "muy_clara" });

        // Varianza Laplaciano 3x3 [[0,1,0],[1,-4,1],[0,1,0]]
        let sum = 0;
        let sumSq = 0;
        let n = 0;
        for (let y = 1; y < size - 1; y++) {
          for (let x = 1; x < size - 1; x++) {
            const idx = y * size + x;
            const lap = gray[idx - size] + gray[idx - 1] + gray[idx + 1] + gray[idx + size] - 4 * gray[idx];
            sum += lap;
            sumSq += lap * lap;
            n++;
          }
        }
        const mean = sum / n;
        const varianza = sumSq / n - mean * mean;
        resolve({ nitida: varianza > umbral, varianza, motivo: varianza <= umbral ? "borrosa" : undefined });
      } catch {
        resolve({ nitida: true, varianza: 999 });
      }
    };
    img.onerror = () => resolve({ nitida: true, varianza: 999 });
    img.src = dataUrl;
  });
}
