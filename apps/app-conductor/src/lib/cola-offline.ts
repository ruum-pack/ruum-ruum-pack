import { Preferences } from "@capacitor/preferences";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

const CLAVE_COLA = "ruum_cola_evidencia";
const BUCKET_EVIDENCIA = "evidencia";

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

export async function contarColaEvidencia(trasladoId?: string): Promise<number> {
  const cola = await leerColaEvidencia();
  return trasladoId ? cola.filter((item) => item.trasladoId === trasladoId).length : cola.length;
}

export async function leerColaEvidenciaDeTraslado(trasladoId: string): Promise<ItemColaEvidencia[]> {
  const cola = await leerColaEvidencia();
  return cola.filter((item) => item.trasladoId === trasladoId);
}

function extensionDesdeDataUrl(dataUrl: string) {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUrl);
  const formato = match?.[1]?.toLowerCase();
  if (formato === "jpeg") return "jpg";
  if (formato === "png" || formato === "webp" || formato === "jpg") return formato;
  return "jpg";
}

function blobDesdeDataUrl(dataUrl: string): Blob {
  const [metadata, base64] = dataUrl.split(",");
  if (!metadata || !base64) {
    throw new Error("Foto local inválida: no tiene formato data URL.");
  }

  const mime = /^data:([^;]+);base64$/.exec(metadata)?.[1] ?? "image/jpeg";
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    buffer[i] = bytes.charCodeAt(i);
  }
  return new Blob([buffer], { type: mime });
}

export async function sincronizarColaEvidencia(
  cliente: SupabaseClient<Database>,
  opciones: {
    trasladoId?: string;
    onItemSincronizado?: (item: ItemColaEvidencia) => void | Promise<void>;
  } = {}
) {
  const cola = await leerColaEvidencia();
  const items = opciones.trasladoId ? cola.filter((item) => item.trasladoId === opciones.trasladoId) : cola;
  let sincronizadas = 0;

  for (const item of items) {
    const extension = extensionDesdeDataUrl(item.dataUrl);
    const ruta = `${item.trasladoId}/${item.tipo}/${item.localId}-${item.angulo}.${extension}`;
    const blob = blobDesdeDataUrl(item.dataUrl);

    const { error: uploadError } = await cliente.storage.from(BUCKET_EVIDENCIA).upload(ruta, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg"
    });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = cliente.storage.from(BUCKET_EVIDENCIA).getPublicUrl(ruta);
    const { error: evidenciaError } = await cliente.from("evidencia_fotos").upsert(
      {
        id: item.localId,
        traslado_id: item.trasladoId,
        tipo: item.tipo,
        angulo: item.angulo as Database["public"]["Enums"]["angulo_evidencia"],
        url: publicUrl.publicUrl,
        local_path: null,
        capturada_en: item.capturadaEn,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        sincronizada: true
      },
      { onConflict: "id" }
    );

    if (evidenciaError) throw evidenciaError;

    await quitarDeColaEvidencia(item.localId);
    sincronizadas += 1;
    await opciones.onItemSincronizado?.(item);
  }

  if (sincronizadas > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ruum:evidencia-sincronizada"));
  }

  return sincronizadas;
}
