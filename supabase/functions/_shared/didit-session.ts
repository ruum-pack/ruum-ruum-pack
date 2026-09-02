/// <reference lib="deno.ns" />
/// <reference lib="dom" />

const DIDIT_HOST = "verify.didit.me";
const DIDIT_SESSION_PATH = "/v3/session/";
const MAX_RETRATO_BYTES = 2 * 1024 * 1024;
const MIME_RETRATO_PERMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

export function urlSesionDidit(): string {
  return `https://verification.didit.me${DIDIT_SESSION_PATH}`;
}

/**
 * La URL de foto_url es editable en el perfil. Sólo se debe seguir la URL
 * que apunta al objeto de perfil del mismo proyecto Supabase y del usuario
 * autenticado; así el fetch del servidor no se convierte en SSRF.
 */
export function esFotoPerfilDiditValida(
  fotoUrl: string | null | undefined,
  supabaseUrl: string,
  authUserId: string,
): boolean {
  if (!fotoUrl || !supabaseUrl || !authUserId) return false;

  try {
    const base = new URL(supabaseUrl);
    const candidata = new URL(fotoUrl);
    const prefijo = `/storage/v1/object/public/fotos-perfil/${authUserId}/`;
    const nombre = candidata.pathname.slice(prefijo.length);

    return candidata.protocol === base.protocol &&
      candidata.origin === base.origin &&
      candidata.pathname.startsWith(prefijo) &&
      /^[^/]+\.(?:jpe?g|png|webp)$/i.test(nombre);
  } catch {
    return false;
  }
}

function base64DesdeBytes(bytes: Uint8Array): string {
  let resultado = "";
  const tamanoBloque = 0x8000;
  for (let inicio = 0; inicio < bytes.length; inicio += tamanoBloque) {
    resultado += String.fromCharCode(
      ...bytes.subarray(inicio, inicio + tamanoBloque),
    );
  }
  return btoa(resultado);
}

/** Descarga la foto de perfil validada y la convierte al formato que exige Didit. */
export async function obtenerRetratoDidit(
  fotoUrl: string | null | undefined,
  supabaseUrl: string,
  authUserId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!esFotoPerfilDiditValida(fotoUrl, supabaseUrl, authUserId)) return null;

  try {
    const respuesta = await fetchImpl(fotoUrl!, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    });
    if (!respuesta.ok) return null;

    const mime = (respuesta.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    const longitud = Number(respuesta.headers.get("content-length"));
    if (
      !MIME_RETRATO_PERMITIDOS.has(mime) ||
      (Number.isFinite(longitud) && longitud > MAX_RETRATO_BYTES)
    ) {
      return null;
    }

    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_RETRATO_BYTES) return null;
    return base64DesdeBytes(bytes);
  } catch {
    // La foto es un dato auxiliar. Si no se puede descargar, Didit puede
    // continuar con workflows que no exigen Face Match.
    return null;
  }
}

export function construirPayloadSesionDidit({
  workflowId,
  vendorData,
  callbackUrl,
  portraitImage,
}: {
  workflowId: string;
  vendorData: string;
  callbackUrl?: string;
  portraitImage?: string | null;
}): Registro {
  return {
    workflow_id: workflowId,
    vendor_data: vendorData,
    ...(callbackUrl ? { callback: callbackUrl, callback_method: "both" } : {}),
    ...(portraitImage ? { portrait_image: portraitImage } : {}),
    language: "es",
  };
}

/** Extrae detail/error/message sin perder el cuerpo JSON que devuelve Didit. */
export function detalleRespuestaDidit(cuerpo: string): string {
  const texto = cuerpo.trim();
  if (!texto) return "";

  try {
    const json = JSON.parse(texto) as unknown;
    if (typeof json === "string") return json.slice(0, 2000);
    if (esRegistro(json)) {
      for (const campo of ["detail", "error", "message"]) {
        const valor = json[campo];
        if (typeof valor === "string" && valor.trim()) {
          return valor.trim().slice(0, 2000);
        }
      }
      if (json.errors !== undefined) {
        return JSON.stringify(json.errors).slice(0, 2000);
      }
      return JSON.stringify(json).slice(0, 2000);
    }
  } catch {
    // Didit también puede devolver texto plano.
  }
  return texto.slice(0, 2000);
}

export function esUrlHospedadaDiditValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !valor.startsWith("https://")) return false;
  try {
    const url = new URL(valor);
    return url.hostname === DIDIT_HOST || url.hostname.endsWith(".didit.me");
  } catch {
    return false;
  }
}
