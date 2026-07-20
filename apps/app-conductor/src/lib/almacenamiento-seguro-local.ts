import { Preferences } from "@capacitor/preferences";

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

async function llaveAes() {
  const secreto = await obtenerSecretoInstalacion();
  const material = await crypto.subtle.importKey("raw", base64ToBytes(secreto), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
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
}

export async function guardarJsonLocalSeguro<T>(key: string, payload: T) {
  const value = JSON.stringify({ version: VERSION_PAYLOAD, payload });

  if (!cryptoDisponible()) {
    await Preferences.set({ key, value });
    return;
  }

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await llaveAes(), new TextEncoder().encode(value));
  await Preferences.set({
    key,
    value: `${PREFIJO_CIFRADO}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`
  });
}

export async function leerJsonLocalSeguro<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key });
  if (!value) return null;

  try {
    if (value.startsWith(PREFIJO_CIFRADO) && cryptoDisponible()) {
      const [ivB64, payloadB64] = value.slice(PREFIJO_CIFRADO.length).split(":");
      if (!ivB64 || !payloadB64) return null;
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(ivB64) },
        await llaveAes(),
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

