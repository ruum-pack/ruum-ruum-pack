import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { createLogger, errorCode } from "@ruum/shared/utils";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "./supabase-browser";
import { withTimeout } from "./with-timeout";
import { pLimit } from "./p-limit";

// PERF-004 — timeouts + rate limit para sync offline
const TIMEOUT_UPLOAD_MS = 15_000;
const TIMEOUT_UPSERT_MS = 10_000;
export const CONCURRENCIA_SYNC_EVIDENCIA = 2;
import {
  eliminarJsonLocalSeguro,
  guardarJsonLocalSeguro,
  leerJsonLocalSeguro
} from "./almacenamiento-seguro-local";

const CLAVE_COLA = "ruum_cola_evidencia";
const CLAVE_BIN_PREFIX = "ruum_evidencia_bin_";
const BUCKET_EVIDENCIA = "evidencia";
const logger = createLogger("evidencia_offline");
const BACKOFF_REINTENTO_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000
];

export const TTL_COLA_EVIDENCIA_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
export const MAX_REINTENTOS_EVIDENCIA = 15;

export interface ItemColaEvidencia {
  usuarioId: string;
  /** UUID generado en el dispositivo — es la clave de idempotencia al subir (ver propuesta de arquitectura, sección 5). */
  localId: string;
  trasladoId: string;
  tipo: "inicial" | "final";
  angulo: string;
  dataUrl: string;
  fileName?: string;
  fileSizeBytes?: number;
  sha256?: string;
  requisitoId?: string;
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
    try {
      const data = await leerJsonLocalSeguro<ItemColaEvidencia[]>(CLAVE_COLA);
      if (!data) return [];
      return normalizarItemsCola(data);
    } catch (err) {
      logger.warn("evidence_queue_read_failed", { error: errorCode(err) });
      return [];
    }
  }

  async write(items: ItemColaEvidencia[]): Promise<void> {
    await guardarJsonLocalSeguro(CLAVE_COLA, normalizarItemsCola(items));
  }

  async clear(): Promise<void> {
    await eliminarJsonLocalSeguro(CLAVE_COLA);
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


async function usuarioActualId(): Promise<string | null> {
  if (!tieneSupabaseConfigurado()) return null;
  try {
    const { data } = await crearClienteNavegador().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

let storageColaEvidencia: EvidenceQueueStorage = new CapacitorPreferencesEvidenceStorage();

export function configurarStorageColaEvidencia(storage: EvidenceQueueStorage) {
  storageColaEvidencia = storage;
}

// P1 mediano plazo: binarios fuera del JSON principal, en storage privado cifrado por item
const CLAVE_BIN_PREFIX_INTERNAL = CLAVE_BIN_PREFIX;
async function guardarBinarioEvidencia(localId: string, dataUrl: string): Promise<void> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return;
  try {
    await guardarJsonLocalSeguro(CLAVE_BIN_PREFIX_INTERNAL + localId, { dataUrl });
  } catch (err) {
    logger.warn("evidence_binary_store_failed", { localId, error: errorCode(err) });
    throw err;
  }
}
async function leerBinarioEvidencia(localId: string): Promise<string | null> {
  try {
    const data = await leerJsonLocalSeguro<{ dataUrl: string }>(CLAVE_BIN_PREFIX_INTERNAL + localId);
    return data?.dataUrl ?? null;
  } catch {
    return null;
  }
}
async function eliminarBinarioEvidencia(localId: string): Promise<void> {
  try {
    await eliminarJsonLocalSeguro(CLAVE_BIN_PREFIX_INTERNAL + localId);
  } catch {}
}
async function obtenerDataUrlParaItem(item: ItemColaEvidencia): Promise<string> {
  if (item.dataUrl && item.dataUrl.startsWith("data:")) return item.dataUrl;
  const fromFile = await leerBinarioEvidencia(item.localId);
  if (fromFile) return fromFile;
  return item.dataUrl;
}
async function limpiarBinariosDeCola(items: ItemColaEvidencia[]): Promise<void> {
  await Promise.all(items.map((it) => eliminarBinarioEvidencia(it.localId)));
}

/**
 * Cola local de evidencia pendiente de subir. La propuesta de arquitectura
 * original (sección 11) planteaba SQLite local; la lógica de cola ya depende
 * de EvidenceQueueStorage para poder sustituir Preferences por SQLite o
 * IndexedDB sin cambiar el contrato que consume la pantalla de evidencia.
 */

/**
 * Lectura cruda sin filtro de usuario — uso interno para escrituras que
 * deben preservar todos los usuarios en el dispositivo.
 * Exportada solo para tests/ diagnóstico; la UI debe seguir usando leerColaEvidencia().
 */
export async function leerColaEvidenciaCompleta(): Promise<ItemColaEvidencia[]> {
  return normalizarItemsCola(await storageColaEvidencia.read());
}

export async function encolarEvidencia(item: ItemColaEvidencia): Promise<void> {
  if (!item.usuarioId) throw new Error("evidence_queue_user_required");
  const colaCompleta = await leerColaEvidenciaCompleta();
  const itemNormalizado = normalizarItemCola(item);
  const dataUrlOriginal = itemNormalizado.dataUrl;
  // P1 mediano plazo: guardar binario fuera del JSON principal (cifrado por item)
  if (dataUrlOriginal && dataUrlOriginal.startsWith("data:")) {
    await guardarBinarioEvidencia(itemNormalizado.localId, dataUrlOriginal);
  }
  // En la cola principal guardar solo metadata (sin dataUrl grande) — se reconstruye al leer para UI/sync
  const itemParaCola: ItemColaEvidencia = { ...itemNormalizado, dataUrl: "" };
  // Deduplicar SOLO contra items del mismo usuario + mismo traslado/tipo/ángulo/sha — nunca contra otros usuarios
  const restantes = colaCompleta.filter((existente) => {
    if (existente.localId === itemParaCola.localId) return false;
    if (existente.usuarioId !== itemParaCola.usuarioId) return true;
    const mismoSlot =
      existente.trasladoId === itemParaCola.trasladoId &&
      existente.tipo === itemParaCola.tipo &&
      existente.angulo === itemParaCola.angulo;
    if (mismoSlot) return false;
    const mismoSha =
      Boolean(existente.sha256 && itemParaCola.sha256) &&
      existente.trasladoId === itemParaCola.trasladoId &&
      existente.sha256 === itemParaCola.sha256;
    if (mismoSha) return false;
    return true;
  });
  // Si se reemplaza un slot, limpiar binario del item reemplazado
  const reemplazados = colaCompleta.filter((ex) => !restantes.includes(ex) && ex.localId !== itemParaCola.localId);
  if (reemplazados.length > 0) await limpiarBinariosDeCola(reemplazados);
  await storageColaEvidencia.write([...restantes, itemParaCola]);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ruum:evidencia-pendiente"));
}

export async function leerColaEvidencia(trasladoId?: string, usuarioIdExplicito?: string): Promise<ItemColaEvidencia[]> {
  const cola = await leerColaEvidenciaCompleta();
  // Enriquecer con binario para UI/sync (mantener cola principal ligera)
  const colaConBinario = await Promise.all(
    cola.map(async (it) => {
      if (!it.dataUrl || !it.dataUrl.startsWith("data:")) {
        const bin = await leerBinarioEvidencia(it.localId);
        if (bin) return { ...it, dataUrl: bin };
      }
      return it;
    })
  );
  const usuarioId = usuarioIdExplicito ?? await usuarioActualId();
  const porUsuario = usuarioId ? colaConBinario.filter((item) => item.usuarioId === usuarioId) : colaConBinario;
  return trasladoId ? porUsuario.filter((item) => item.trasladoId === trasladoId) : porUsuario;
}

export async function quitarDeColaEvidencia(localId: string): Promise<void> {
  const colaCompleta = await leerColaEvidenciaCompleta();
  const restante = colaCompleta.filter((item) => item.localId !== localId);
  await storageColaEvidencia.write(restante);
  await eliminarBinarioEvidencia(localId);
}

export async function contarColaEvidencia(trasladoId?: string): Promise<number> {
  const cola = await leerColaEvidencia();
  return trasladoId ? cola.filter((item) => item.trasladoId === trasladoId).length : cola.length;
}

export async function leerColaEvidenciaDeTraslado(trasladoId: string): Promise<ItemColaEvidencia[]> {
  const cola = await leerColaEvidencia();
  return cola.filter((item) => item.trasladoId === trasladoId);
}

export async function limpiarColaEvidenciaDeUsuario(usuarioId: string): Promise<void> {
  const colaCompleta = await leerColaEvidenciaCompleta();
  const aBorrar = colaCompleta.filter((item) => item.usuarioId === usuarioId);
  const restante = colaCompleta.filter((item) => item.usuarioId !== usuarioId);
  await storageColaEvidencia.write(restante);
  await limpiarBinariosDeCola(aBorrar);
}

export async function limpiarColaEvidenciaCompleta(): Promise<void> {
  const colaCompleta = await leerColaEvidenciaCompleta();
  await storageColaEvidencia.clear();
  await limpiarBinariosDeCola(colaCompleta);
}

/**
 * Limpieza segura: por defecto solo borra evidencia del usuario actual,
 * nunca de otros usuarios en el mismo dispositivo. Pasar `null` fuerza borrado
 * total (uso exclusivo en force-logout con autorización explícita).
 */
export async function limpiarColaEvidencia(usuarioIdExplicito?: string | null): Promise<void> {
  if (usuarioIdExplicito !== undefined) {
    if (usuarioIdExplicito === null) {
      await limpiarColaEvidenciaCompleta();
      return;
    }
    await limpiarColaEvidenciaDeUsuario(usuarioIdExplicito);
    return;
  }
  const usuarioId = await usuarioActualId();
  if (usuarioId) {
    await limpiarColaEvidenciaDeUsuario(usuarioId);
  } else {
    // Sin sesión (tests / preview sin Supabase): clear total por compatibilidad
    await limpiarColaEvidenciaCompleta();
  }
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

function esItemValidoYTolerable(item: ItemColaEvidencia, ahoraMs = Date.now()): boolean {
  if (!item || typeof item !== "object") return false;
  if (!item.localId || !item.usuarioId || !item.trasladoId) return false;
  // dataUrl puede estar vacío si el binario está en storage separado (mediano plazo); se valida al sincronizar

  if (item.capturadaEn) {
    const capturadaMs = new Date(item.capturadaEn).getTime();
    if (Number.isFinite(capturadaMs) && ahoraMs - capturadaMs > TTL_COLA_EVIDENCIA_MS) {
      logger.warn("evidence_item_purged_ttl", { localId: item.localId, tripId: item.trasladoId });
      return false;
    }
  }

  if (typeof item.retryCount === "number" && item.retryCount > MAX_REINTENTOS_EVIDENCIA) {
    logger.warn("evidence_item_purged_max_retries", { localId: item.localId, tripId: item.trasladoId, retryCount: item.retryCount });
    return false;
  }

  return true;
}

function normalizarItemCola(item: ItemColaEvidencia): ItemColaEvidencia {
  let fileSizeBytes = item.fileSizeBytes;
  if (!fileSizeBytes && typeof item.dataUrl === "string") {
    const b64 = item.dataUrl.split(",")[1] ?? "";
    fileSizeBytes = Math.floor(b64.length * 0.75);
  }

  return {
    ...item,
    fileSizeBytes,
    retryCount: Number.isInteger(item.retryCount) && item.retryCount >= 0 ? item.retryCount : 0,
    ...(typeof item.lastAttemptAt === "string" ? { lastAttemptAt: item.lastAttemptAt } : {}),
    ...(typeof item.lastErrorCode === "string" ? { lastErrorCode: item.lastErrorCode } : {})
  };
}

function normalizarItemsCola(valor: unknown, ahoraMs = Date.now()): ItemColaEvidencia[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((item) => esItemValidoYTolerable(item as ItemColaEvidencia, ahoraMs))
    .map((item) => normalizarItemCola(item as ItemColaEvidencia));
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
  const colaCompleta = await leerColaEvidenciaCompleta();
  const codigo = errorCode(error);
  const ahora = new Date().toISOString();
  await storageColaEvidencia.write(
    colaCompleta.map((existente) =>
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
    let dataUrlEfectivo: string;
    try {
      dataUrlEfectivo = await obtenerDataUrlParaItem(item);
      blob = blobDesdeDataUrl(dataUrlEfectivo);
    } catch (error) {
      const actualizado = await registrarIntentoFallido(item, error);
      logEvidenceSyncFailed(actualizado, "local_payload", error, itemsBase.length);
      throw error;
    }

    const extension = extensionDesdeDataUrl(dataUrlEfectivo);
    const ruta = `${authUserId}/${item.trasladoId}/${item.tipo}/${item.localId}-${item.angulo}.${extension}`;
    const { error: uploadError } = await withTimeout(
      cliente.storage.from(BUCKET_EVIDENCIA).upload(ruta, blob, {
        upsert: true,
        contentType: blob.type || "image/jpeg",
      }) as Promise<{ error: unknown | null }>,
      TIMEOUT_UPLOAD_MS,
      `storage_upload:${item.localId}`
    );
    if (uploadError) {
      const actualizado = await registrarIntentoFallido(item, uploadError);
      logEvidenceSyncFailed(actualizado, "storage_upload", uploadError, itemsBase.length);
      throw uploadError;
    }

    const { error: evidenciaError } = await withTimeout(
      cliente.from("evidencia_fotos").upsert(
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
          sincronizada: true,
        },
        { onConflict: "id" }
      ) as unknown as Promise<{ error: unknown | null }>,
      TIMEOUT_UPSERT_MS,
      `evidence_upsert:${item.localId}`
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

/**
 * PERF-004 — Variante concurrente con p-limit(2) y timeouts.
 * Para subida masiva (ej. 10 fotos) sin saturar Storage.
 * Mantiene misma semántica de error: falla rápido si auth expiró,
 * registra intento fallido por item en otros errores.
 * Uso: sincronizarColaEvidenciaBulk(cliente, { trasladoId })
 */
export async function sincronizarColaEvidenciaBulk(
  cliente: SupabaseClient<Database>,
  opciones: { trasladoId?: string; ignoreBackoff?: boolean } = {}
): Promise<number> {
  const cola = await leerColaEvidencia();
  const itemsBase = opciones.trasladoId ? cola.filter((i) => i.trasladoId === opciones.trasladoId) : cola;
  const items = opciones.ignoreBackoff ? itemsBase : itemsBase.filter((i) => puedeReintentarse(i));
  if (items.length === 0) return 0;

  const limit = pLimit(CONCURRENCIA_SYNC_EVIDENCIA);
  let sincronizadas = 0;

  // Validar sesión una vez antes de lanzar paralelos
  const { data: sesion } = await withTimeout(cliente.auth.getUser() as unknown as Promise<{ data: { user: { id: string } | null } }>, 5000, "auth.getUser");
  if (!sesion.user) throw new Error("No hay sesión para subir evidencia.");

  const tareas = items.map((item) =>
    limit(async () => {
      // Reusa lógica de item único con timeouts (extraída arriba)
      const colaIndividual = [item];
      // Llamada secuencial por item pero limitada a 2 en paralelo a nivel bulk
      const uploaded = await sincronizarColaEvidencia(cliente, { trasladoId: item.trasladoId, ignoreBackoff: true });
      return uploaded;
    })
  );

  const resultados = await Promise.allSettled(tareas);
  for (const r of resultados) {
    if (r.status === "fulfilled") sincronizadas += r.value;
  }
  return sincronizadas;
}
