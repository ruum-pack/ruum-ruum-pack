import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { esNativo } from "./capacitor";

export interface FotoCapturada {
  dataUrl: string;
}

/**
 * PRD §4.4 — captura de evidencia fotográfica. Solo funciona dentro del
 * shell nativo (cámara real vía Capacitor); en navegador devuelve null para
 * que la pantalla siga su flujo de respaldo actual ("Marcar capturado" sin
 * foto real, ya documentado como modo dev en el README).
 */
export async function capturarFoto(): Promise<FotoCapturada | null> {
  if (!esNativo()) return null;

  const foto = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 75,
    saveToGallery: false
  });

  if (!foto.dataUrl) return null;
  return { dataUrl: foto.dataUrl };
}
