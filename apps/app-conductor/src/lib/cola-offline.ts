import { Preferences } from "@capacitor/preferences";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { createLogger, errorCode } from "@ruum/shared/utils";

const CLAVE_COLA = "ruum_cola_evidencia";
const BUCKET_EVIDENCIA = "evidencia";
const logger = createLogger("evidencia_offline");

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

export interface EvidenceQueueStorage {
  read(): Promise<ItemColaEvidencia[]>;
  write(items: ItemColaEvidencia[]): Promise<void>;
  clear(): Promise<void>;
}

export class CapacitorPreferencesEvidenceStorage implements EvidenceQueueStorage {
  async read(): Promise<ItemColaEvidencia[]> {
    const { value } = await Preferences.get({ key: CLAVE_COLA });
    if (!value) return [];
    try {
      return JSON.parse(value) as ItemColaEvidencia[];
    } catch {
      return [];
    }
  }

  async write(items: ItemColaEvidencia[]): Promise<void> {
    await Preferences.set({ key: CLAVE_COLA, value: JSON.stringify(items) });
  }

  async clear(): Promise<void> {
    await this.write([]);
  }
}

export class InMemoryEvidenceStorage implements EvidenceQueueStorage {
  private items: ItemColaEvidencia[];

  constructor(initialItems: ItemColaEvidencia[] = []) {
    this.items = [...initialItems];
  }

  async read(): Promise<ItemColaEvidencia[]> {
    return [...this.items];
  }

  async write(items: ItemColaEvidencia[]): Promise<void> {
    this.items = [...items];
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}

let storageColaEvidencia: EvidenceQueueStorage = new CapacitorPreferencesEvidenceStorage();

export function configurarStorageColaEvidencia(storage: EvidenceQueueStorage) {
  storageColaEvidencia = storage;
}

/**
 * Cola local de evidencia pendiente de subir. La propuesta de arquitectura
 * original (sección 11) planteaba SQLite local; la lógica de cola ya depende
 * de EvidenceQueueStorage para poder sustituir Preferences por SQLite o
 * IndexedDB sin cambiar el contrato que consume la pantalla de evidencia.
 */
export async function encolarEvidencia(item: ItemColaEvidencia): Promise<void> {
  const cola = await leerColaEvidencia();
  const sinDuplicados = cola.filter(
    (existente) =>
      existente.localId !== item.localId &&
      !(
        existente.trasladoId === item.trasladoId &&
        existente.tipo === item.tipo &&
        existente.angulo === item.angulo
      )
  );
  await storageColaEvidencia.write([...sinDuplicados, item]);
}

export async function leerColaEvidencia(): Promise<ItemColaEvidencia[]> {
  return storageColaEvidencia.read();
}

export async function quitarDeColaEvidencia(localId: string): Promise<void> {
  const cola = await leerColaEvidencia();
  const restante = cola.filter((item) => item.localId !== localId);
  await storageColaEvidencia.write(restante);
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

function isOnline() {
  if (typeof navigator === "undefined") return null;
  return navigator.onLine;
}

function logEvidenceSyncFailed(
  item: ItemColaEvidencia,
  stage: "auth" | "local_payload" | "storage_upload" | "evidence_upsert",
  error: unknown,
  queueSize: number
) {
  logger.error(
    "evidence_sync_failed",
    {
      tripId: item.trasladoId,
      evidenceType: item.tipo,
      angle: item.angulo,
      isOnline: isOnline(),
      retryCount: null,
      queueSize,
      stage,
      errorCode: errorCode(error)
    },
    "offline_recoverable"
  );
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
    const { data: sesion } = await cliente.auth.getUser();
    const authUserId = sesion.user?.id;
    if (!authUserId) {
      const error = new Error("No hay sesión para subir evidencia.");
      logEvidenceSyncFailed(item, "auth", error, items.length);
      throw error;
    }

    let blob: Blob;
    try {
      blob = blobDesdeDataUrl(item.dataUrl);
    } catch (error) {
      logEvidenceSyncFailed(item, "local_payload", error, items.length);
      throw error;
    }

    const extension = extensionDesdeDataUrl(item.dataUrl);
    const ruta = `${authUserId}/${item.trasladoId}/${item.tipo}/${item.localId}-${item.angulo}.${extension}`;
    const { error: uploadError } = await cliente.storage.from(BUCKET_EVIDENCIA).upload(ruta, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg"
    });
    if (uploadError) {
      logEvidenceSyncFailed(item, "storage_upload", uploadError, items.length);
      throw uploadError;
    }

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

    if (evidenciaError) {
      logEvidenceSyncFailed(item, "evidence_upsert", evidenciaError, items.length);
      throw evidenciaError;
    }

    await quitarDeColaEvidencia(item.localId);
    sincronizadas += 1;
    await opciones.onItemSincronizado?.(item);
  }

  if (sincronizadas > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ruum:evidencia-sincronizada"));
  }

  return sincronizadas;
}
