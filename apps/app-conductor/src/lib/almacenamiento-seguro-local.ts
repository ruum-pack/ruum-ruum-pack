import { Preferences } from "@capacitor/preferences";
import { obtenerSecretoKeystoreNativo } from "./background-tracking";

/**
 * ============================================================================
 * ARQUITECTURA DE ALMACENAMIENTO SEGURO LOCAL (H3)
 * ============================================================================
 * Modelo de Amenazas y Fronteras de Protección:
 *
 * 1. Entorno Nativo Android (Hardware-Backed Keystore):
 *    - El secreto maestro se genera con SecureRandom y se almacena en el hardware
 *      seguro (Android Keystore) mediante MasterKey (AES256-GCM) y EncryptedSharedPreferences
 *      (AES256-SIV / AES256-GCM), alineado con SecureTrackingPreferences.
 *    - Protege contra extracción física del dispositivo, volcados de memoria y copias de seguridad.
 *
 * 2. Entorno Web / Híbrido (Capacitor Preferences + WebCrypto):
 *    - La clave AES-GCM (256-bit) se deriva mediante PBKDF2 (120,000 iteraciones SHA-256)
 *      a partir del secreto de instalación local y sal determinística.
 *    - Frontera de protección: Cifra y protege contra inspección casual de almacenamiento local,
 *      logs accidentales, extensiones sin privilegios y lecturas no estructuradas del sandbox.
 *    - Limitación conocida en web/root: En un dispositivo rooteado o depuración USB sin Keystore,
 *      quien tenga acceso total al sandbox de la app puede leer el almacén.
 * ============================================================================
 */

const VERSION_PAYLOAD = 1;
const CLAVE_SECRETO = "ruum_offline_installation_secret_v1";
const PREFIJO_CIFRADO = "ruum:v1:";

function cryptoDisponible() {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle) && typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function obtenerSecretoInstalacion() {
  // 1. En Android Nativo: intentar obtener la semilla respaldada por Android Keystore
  try {
    const keystore = await obtenerSecretoKeystoreNativo();
    if (keystore?.secret) {
      return keystore.secret;
    }
  } catch {
    // Continuar a fallback de preferencias en web/híbrido
  }

  // 2. Fallback de preferencias locales
  const existente = await Preferences.get({ key: CLAVE_SECRETO });
  if (existente.value) return existente.value;

  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }

  const secreto = bytesToBase64(bytes);
  await Preferences.set({ key: CLAVE_SECRETO, value: secreto });
  return secreto;
}

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

export function resetCachedKeyForTesting() {
  cachedKey = null;
  cachedSecret = null;
}

async function llaveAes() {
  const secreto = await obtenerSecretoInstalacion();
  if (cachedKey && cachedSecret === secreto) {
    return cachedKey;
  }

  const material = await crypto.subtle.importKey("raw", base64ToBytes(secreto), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("ruum-conductor-offline-v1"),
      iterations: 120_000,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  cachedKey = key;
  cachedSecret = secreto;
  return key;
}

export async function guardarJsonLocalSeguro<T>(key: string, payload: T) {
  const value = JSON.stringify({ version: VERSION_PAYLOAD, payload });

  if (!cryptoDisponible()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("crypto_subtle_unavailable_secure_storage_required");
    }
    console.warn(`[almacenamiento-seguro-local] WebCrypto no está disponible en este entorno (${process.env.NODE_ENV}). Guardando sin cifrar sólo en modo no productivo.`);
    await Preferences.set({ key, value });
    return;
  }

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const aesKey = await llaveAes();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(value));
  await Preferences.set({
    key,
    value: `${PREFIJO_CIFRADO}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`
  });
}

export async function leerJsonLocalSeguro<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key });
  if (!value) return null;

  try {
    if (value.startsWith(PREFIJO_CIFRADO)) {
      if (!cryptoDisponible()) {
        if (process.env.NODE_ENV === "production") {
          throw new Error("crypto_subtle_unavailable_cannot_decrypt");
        }
        return null;
      }
      const [ivB64, payloadB64] = value.slice(PREFIJO_CIFRADO.length).split(":");
      if (!ivB64 || !payloadB64) return null;
      const aesKey = await llaveAes();
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(ivB64) },
        aesKey,
        base64ToBytes(payloadB64)
      );
      const parsed = JSON.parse(new TextDecoder().decode(decrypted));
      return parsed?.payload ?? null;
    }

    const parsed = JSON.parse(value);
    return parsed?.payload ?? parsed;
  } catch {
    return null;
  }
}

export async function eliminarJsonLocalSeguro(key: string) {
  await Preferences.remove({ key });
}

