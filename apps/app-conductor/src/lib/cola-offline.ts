import { Preferences } from "@capacitor/preferences";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { createLogger, errorCode } from "@ruum/shared/utils";

const CLAVE_COLA = "ruum_cola_evidencia";
const BUCKET_EVIDENCIA = "evidencia";
const logger = createLogger("evidencia_offline");
const BACKOFF_REINTENTO_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000
];

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
  retryCount: number;
  lastAttemptAt?: string;
  lastErrorCode?: string;
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
      return normalizarItemsCola(JSON.parse(value));
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
    this.items = normalizarItemsCola(initialItems);
  }

  async read(): Promise<ItemColaEvidencia[]> {
    return normalizarItemsCola(this.items);
  }

  async write(items: ItemColaEvidencia[]): Promise<void> {
    this.items = normalizarItemsCola(items);
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
  const itemNormalizado = normalizarItemCola(item);
  const sinDuplicados = cola.filter(
    (existente) =>
      existente.localId !== itemNormalizado.localId &&
      !(
        existente.trasladoId === itemNormalizado.trasladoId &&
        existente.tipo === itemNormalizado.tipo &&
        existente.angulo === itemNormalizado.angulo
      )
  );
  await storageColaEvidencia.write([...sinDuplicados, itemNormalizado]);
}

export async function leerColaEvidencia(): Promise<ItemColaEvidencia[]> {
  return normalizarItemsCola(await storageColaEvidencia.read());
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

function normalizarItemCola(item: ItemColaEvidencia): ItemColaEvidencia {
  return {
    ...item,
    retryCount: Number.isInteger(item.retryCount) && item.retryCount >= 0 ? item.retryCount : 0,
    ...(typeof item.lastAttemptAt === "string" ? { lastAttemptAt: item.lastAttemptAt } : {}),
    ...(typeof item.lastErrorCode === "string" ? { lastErrorCode: item.lastErrorCode } : {})
  };
}

function normalizarItemsCola(valor: unknown): ItemColaEvidencia[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => normalizarItemCola(item as ItemColaEvidencia));
}

function backoffMsParaIntentos(retryCount: number) {
  if (retryCount <= 0) return 0;
  return BACKOFF_REINTENTO_MS[Math.min(retryCount - 1, BACKOFF_REINTENTO_MS.length - 1)];
}

function puedeReintentarse(item: ItemColaEvidencia, ahoraMs = Date.now()) {
  if (!item.lastAttemptAt) return true;
  const ultimoIntentoMs = new Date(item.lastAttemptAt).getTime();
  if (!Number.isFinite(ultimoIntentoMs)) return true;
  return ahoraMs - ultimoIntentoMs >= backoffMsParaIntentos(item.retryCount);
}

async function registrarIntentoFallido(item: ItemColaEvidencia, error: unknown) {
  const cola = await leerColaEvidencia();
  const codigo = errorCode(error);
  const ahora = new Date().toISOString();
  await storageColaEvidencia.write(
    cola.map((existente) =>
      existente.localId === item.localId
        ? {
            ...existente,
            retryCount: existente.retryCount + 1,
            lastAttemptAt: ahora,
            lastErrorCode: codigo
          }
        : existente
    )
  );
  return {
    ...item,
    retryCount: item.retryCount + 1,
    lastAttemptAt: ahora,
    lastErrorCode: codigo
  };
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
      retryCount: item.retryCount,
      lastAttemptAt: item.lastAttemptAt ?? null,
      lastErrorCode: item.lastErrorCode ?? null,
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
    ignoreBackoff?: boolean;
    onItemSincronizado?: (item: ItemColaEvidencia) => void | Promise<void>;
  } = {}
) {
  const cola = await leerColaEvidencia();
  const itemsBase = opciones.trasladoId ? cola.filter((item) => item.trasladoId === opciones.trasladoId) : cola;
  const items = opciones.ignoreBackoff ? itemsBase : itemsBase.filter((item) => puedeReintentarse(item));
  let sincronizadas = 0;

  for (const item of items) {
    const { data: sesion } = await cliente.auth.getUser();
    const authUserId = sesion.user?.id;
    if (!authUserId) {
      const error = new Error("No hay sesión para subir evidencia.");
      const actualizado = await registrarIntentoFallido(item, error);
      logEvidenceSyncFailed(actualizado, "auth", error, itemsBase.length);
      throw error;
    }

    let blob: Blob;
    try {
      blob = blobDesdeDataUrl(item.dataUrl);
    } catch (error) {
      const actualizado = await registrarIntentoFallido(item, error);
      logEvidenceSyncFailed(actualizado, "local_payload", error, itemsBase.length);
      throw error;
    }

    const extension = extensionDesdeDataUrl(item.dataUrl);
    const ruta = `${authUserId}/${item.trasladoId}/${item.tipo}/${item.localId}-${item.angulo}.${extension}`;
    const { error: uploadError } = await cliente.storage.from(BUCKET_EVIDENCIA).upload(ruta, blob, {
      upsert: true,
      contentType: blob.type || "image/jpeg"
    });
    if (uploadError) {
      const actualizado = await registrarIntentoFallido(item, uploadError);
      logEvidenceSyncFailed(actualizado, "storage_upload", uploadError, itemsBase.length);
      throw uploadError;
    }

    const { error: evidenciaError } = await cliente.from("evidencia_fotos").upsert(
      {
        id: item.localId,
        traslado_id: item.trasladoId,
        tipo: item.tipo,
        angulo: item.angulo as Database["public"]["Enums"]["angulo_evidencia"],
        url: ruta,
        local_path: null,
        capturada_en: item.capturadaEn,
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        sincronizada: true
      },
      { onConflict: "id" }
    );

    if (evidenciaError) {
      const actualizado = await registrarIntentoFallido(item, evidenciaError);
      logEvidenceSyncFailed(actualizado, "evidence_upsert", evidenciaError, itemsBase.length);
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
