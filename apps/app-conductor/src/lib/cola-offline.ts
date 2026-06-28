import { Preferences } from "@capacitor/preferences";

const CLAVE_COLA = "ruum_cola_evidencia";

export interface ItemColaEvidencia {
  /** UUID generado en el dispositivo — es la clave de idempotencia al subir (ver propuesta de arquitectura, sección 5). */
  localId: string;
  trasladoId: string;
  tipo: "inicial" | "final";
  angulo: string;
  dataUrl: string;
  lat?: number;
  lng?: number;
  capturadaEn: string;
}

/**
 * Cola local de evidencia pendiente de subir. La propuesta de arquitectura
 * original (sección 11) planteaba SQLite local; aquí se usa
 * @capacitor/preferences (key-value simple) como simplificación deliberada
 * para este corte — alcanza para encolar unas pocas fotos pendientes de
 * sincronizar, que es el caso real mientras Supabase Storage no está
 * conectado (ver README, sección Pendiente). Si el volumen de cola
 * justifica una base relacional local más adelante, migrar a
 * @capacitor-community/sqlite es un cambio de implementación detrás de
 * esta misma interfaz, no un cambio de contrato.
 */
export async function encolarEvidencia(item: ItemColaEvidencia): Promise<void> {
  const cola = await leerColaEvidencia();
  cola.push(item);
  await Preferences.set({ key: CLAVE_COLA, value: JSON.stringify(cola) });
}

export async function leerColaEvidencia(): Promise<ItemColaEvidencia[]> {
  const { value } = await Preferences.get({ key: CLAVE_COLA });
  if (!value) return [];
  try {
    return JSON.parse(value) as ItemColaEvidencia[];
  } catch {
    return [];
  }
}

export async function quitarDeColaEvidencia(localId: string): Promise<void> {
  const cola = await leerColaEvidencia();
  const restante = cola.filter((item) => item.localId !== localId);
  await Preferences.set({ key: CLAVE_COLA, value: JSON.stringify(restante) });
}
