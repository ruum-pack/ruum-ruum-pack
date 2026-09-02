import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

function tipoCuentaDesdeMetadata(valor: unknown): "personal" | "empresa" {
  return valor === "empresa" ? "empresa" : "personal";
}

function metadataString(metadata: Record<string, unknown> | undefined, campo: string) {
  return typeof metadata?.[campo] === "string" ? metadata[campo] : null;
}

async function buscarUsuarioPorAuthId(cliente: Cliente, authUserId: string): Promise<UsuarioRow | null> {
  const { data, error } = await cliente
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Usuario asociado a la sesión de Supabase Auth actual, si existe. */
export async function obtenerUsuarioActual(cliente: Cliente) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const usuario = await buscarUsuarioPorAuthId(cliente, sesion.user.id);
  if (usuario) return usuario;

  // Respaldo para cuentas Auth creadas antes de desplegar el trigger 0024/0025
  // o en entornos donde las migraciones aún no corrieron completas. La policy
  // 0021 permite insertar solo la fila propia (auth.uid() = auth_user_id).
  const tipoCuenta = tipoCuentaDesdeMetadata(sesion.user.user_metadata?.tipo_cuenta);
  const metadata = sesion.user.user_metadata;
  // PR-07: No fabricar consentimiento sin acto explícito.
  // La creación del perfil y el registro de consentimiento están separados.
  // El consentimiento solo se registra vía registrarConsentimientoUsuario() con
  // versión concreta, timestamp real, canal y auditoría. Nunca como default.
  const { data: creado, error: errorInsert } = await cliente
    .from("usuarios")
    .insert({
      auth_user_id: sesion.user.id,
      tipo_cuenta: tipoCuenta,
      rol: tipoCuenta === "empresa" ? "titular_empresa" : "personal",
      estado_verificacion: "pendiente",
      telefono: metadataString(metadata, "telefono"),
      nombre: metadataString(metadata, "nombre"),
      pais: metadataString(metadata, "pais"),
      estado: metadataString(metadata, "estado"),
      codigo_postal: metadataString(metadata, "codigo_postal"),
      ciudad: metadataString(metadata, "ciudad"),
      colonia: metadataString(metadata, "colonia"),
      calle: metadataString(metadata, "calle"),
      numero: metadataString(metadata, "numero"),
      referencias: metadataString(metadata, "referencias"),
      direccion_principal: metadataString(metadata, "direccion_principal"),
      version_terminos_aceptada: null,
      terminos_aceptados_en: null
    })
    .select("*")
    .single();

  if (!errorInsert) return creado;

  const usuarioCreadoEnParalelo = await buscarUsuarioPorAuthId(cliente, sesion.user.id);
  if (usuarioCreadoEnParalelo) return usuarioCreadoEnParalelo;

  throw errorInsert;
}

export type PerfilUsuarioActualizable = Pick<
  Database["public"]["Tables"]["usuarios"]["Update"],
  | "nombre"
  | "foto_url"
  | "telefono"
  | "pais"
  | "estado"
  | "codigo_postal"
  | "ciudad"
  | "colonia"
  | "calle"
  | "numero"
  | "referencias"
  | "direccion_principal"
  | "correo_facturacion"
>;

export async function actualizarPerfilUsuario(cliente: Cliente, datos: PerfilUsuarioActualizable): Promise<UsuarioRow> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Sin sesión activa.");

  const { data, error } = await cliente
    .from("usuarios")
    .update(datos)
    .eq("auth_user_id", sesion.user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export type FacturacionActualizable = {
  rfc: string | null;
  razon_social: string | null;
  regimen_fiscal: string | null;
  codigo_postal_fiscal: string | null;
  uso_cfdi: string | null;
  correo_facturacion: string | null;
};

export async function actualizarFacturacionUsuario(cliente: Cliente, datos: FacturacionActualizable): Promise<void> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion?.user) throw new Error("Sin sesión activa.");

  const { error } = await cliente.rpc("actualizar_datos_facturacion" as never, {
    p_rfc: datos.rfc ?? null,
    p_razon_social: datos.razon_social ?? null,
    p_regimen_fiscal: datos.regimen_fiscal ?? null,
    p_codigo_postal_fiscal: datos.codigo_postal_fiscal ?? null,
    p_uso_cfdi: datos.uso_cfdi ?? null,
    p_correo_facturacion: datos.correo_facturacion ?? null,
  } as never);

  if (error) throw error;
}

// PR-09 Hardening Storage Usuario — Validación server-side (no confiar solo en file.type)
// y fail-closed si bucket requerido no existe.
export const TAMANO_MAX_FOTO_USUARIO_BYTES = 5 * 1024 * 1024;
export const EXTENSIONES_FOTO_USUARIO_PERMITIDAS = new Set(["jpg", "jpeg", "png", "webp"]);
export const MIME_FOTO_USUARIO_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionFotoUsuario(nombre: string): string {
  return nombre.split(".").pop()?.toLowerCase().trim() ?? "";
}

/**
 * Valida magic bytes (firma binaria) para no confiar solo en file.type.
 * JPEG: FF D8 FF, PNG: 89 50 4E 47, WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
 */
export async function validarMagicBytesFoto(archivo: File, ext: string): Promise<void> {
  const slice = archivo.slice(0, 12);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (ext === "jpg" || ext === "jpeg") {
    if (!(bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
      throw new Error("El archivo no es un JPEG válido (firma binaria no coincide).");
    }
  } else if (ext === "png") {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!pngSig.every((b, i) => bytes[i] === b)) {
      throw new Error("El archivo no es un PNG válido (firma binaria no coincide).");
    }
  } else if (ext === "webp") {
    if (!(bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)) {
      throw new Error("El archivo no es un WEBP válido (firma binaria no coincide).");
    }
  }
}

export async function validarFotoPerfilUsuario(archivo: File): Promise<{ extension: string; mime: string }> {
  if (!archivo || typeof archivo.size !== "number") throw new Error("Archivo no válido.");
  if (archivo.size > TAMANO_MAX_FOTO_USUARIO_BYTES) {
    throw new Error(`La foto debe pesar máximo ${TAMANO_MAX_FOTO_USUARIO_BYTES / (1024 * 1024)} MB.`);
  }
  if (archivo.size === 0) throw new Error("El archivo está vacío.");

  const extRaw = extensionFotoUsuario(archivo.name);
  if (!EXTENSIONES_FOTO_USUARIO_PERMITIDAS.has(extRaw)) {
    throw new Error("La foto debe ser JPG, PNG o WEBP.");
  }
  // Normalizar jpeg -> jpg para nombre interno, pero mantener validación
  const ext = extRaw === "jpeg" ? "jpg" : extRaw;
  const mimeEsperado = MIME_POR_EXTENSION[extRaw] ?? MIME_POR_EXTENSION[ext];
  // No confiar solo en file.type: si viene vacío u octet-stream, inferir por extensión + magic bytes
  const mimeDeclarado = (archivo.type || "").toLowerCase().trim();
  if (mimeDeclarado && mimeDeclarado !== "application/octet-stream" && !MIME_FOTO_USUARIO_PERMITIDOS.has(mimeDeclarado)) {
    throw new Error("Tipo MIME no permitido. Usa JPG, PNG o WEBP.");
  }
  if (mimeDeclarado && mimeDeclarado !== "application/octet-stream" && mimeDeclarado !== mimeEsperado) {
    throw new Error(`La extensión .${extRaw} no coincide con el tipo MIME declarado (${mimeDeclarado}).`);
  }
  await validarMagicBytesFoto(archivo, extRaw);
  return { extension: ext, mime: mimeEsperado };
}

export async function subirFotoPerfil(cliente: Cliente, archivo: File): Promise<string> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Sin sesión activa.");

  // Validación server-side (tamaño, extensión, MIME, magic bytes)
  const validado = await validarFotoPerfilUsuario(archivo);

  // Nombre generado internamente, path basado en identidad (RLS: foldername = auth.uid())
  const path = `${sesion.user.id}/perfil.${validado.extension}`;
  const foto = await subirArchivoPerfil(cliente, "fotos-perfil", path, archivo, validado.mime);

  const { data } = cliente.storage.from(foto.bucket).getPublicUrl(foto.path);
  const fotoUrl = `${data.publicUrl}?v=${Date.now()}`;

  await actualizarPerfilUsuario(cliente, { foto_url: fotoUrl } as PerfilUsuarioActualizable);
  return fotoUrl;
}

async function subirArchivoPerfil(
  cliente: Cliente,
  bucket: string,
  path: string,
  archivo: File,
  contentType: string
): Promise<{ bucket: string; path: string }> {
  const { error } = await cliente.storage.from(bucket).upload(path, archivo, {
    upsert: true,
    contentType,
  });

  if (!error) return { bucket, path };

  const mensaje = error.message.toLowerCase();
  // PR-09: Eliminar fallback silencioso fotos-perfil → evidencia.
  // Si el bucket requerido no existe en producción: fail-closed.
  if (mensaje.includes("bucket not found")) {
    throw new Error("Bucket fotos-perfil no disponible. No se realizó fallback silencioso a evidencia (fail-closed).");
  }

  throw error;
}

/**
 * Sube el documento de identidad del usuario al bucket privado
 * "documentos-identidad" y guarda el path relativo en usuarios.
 */
export type ResultadoDocumentoIdentidad = {
  ruta: string;
  estado: "en_revision";
  subidoEn: string;
};

async function mensajeErrorFuncion(error: unknown) {
  const contexto = (error as { context?: Response })?.context;
  if (contexto) {
    try {
      const cuerpo = await contexto.clone().json() as { error?: unknown };
      if (typeof cuerpo.error === "string") return cuerpo.error;
    } catch { /* La respuesta no era JSON; usamos el mensaje normalizado. */ }
  }
  return error instanceof Error ? error.message : "No fue posible validar el documento.";
}

export async function subirDocumentoIdentidad(
  cliente: Cliente,
  archivo: File
): Promise<ResultadoDocumentoIdentidad> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  const { data, error } = await cliente.functions.invoke<ResultadoDocumentoIdentidad>(
    "validar-documento-identidad",
    { body: formulario }
  );
  if (error) throw new Error(await mensajeErrorFuncion(error));
  if (!data || data.estado !== "en_revision" || !data.ruta || !data.subidoEn) {
    throw new Error("El servidor no confirmó el registro del documento.");
  }
  return data;
}

/**
 * Inicia una sesión de verificación de identidad con Didit (OCR + liveness + face match)
 * para el usuario/pasajero actual. Devuelve la URL del flujo hospedado por Didit.
 */
export async function iniciarVerificacionDiditUsuario(cliente: Cliente): Promise<{ url: string; sessionId?: string }> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Inicia sesión para continuar con la verificación.");

  const { data, error } = await cliente.functions.invoke("iniciar-verificacion-didit", {
    body: { tipo: "usuario" }
  });

  if (error) {
    let mensaje = error.message;
    const contexto = "context" in error ? error.context : null;
    if (contexto instanceof Response) {
      try {
        const detalle = (await contexto.clone().json()) as { error?: string };
        mensaje = detalle.error ?? mensaje;
      } catch {
        // Conserva el mensaje de transporte cuando el servidor no devolvió JSON.
      }
    }
    throw new Error(mensaje);
  }

  const respuesta = data as {
    url?: string;
    verification_url?: string;
    session_url?: string;
    session_id?: string;
    sessionId?: string;
  } | null;
  const urlFinal = respuesta?.url ?? respuesta?.verification_url ?? respuesta?.session_url;
  if (!urlFinal || typeof urlFinal !== "string" || !urlFinal.startsWith("https://")) {
    throw new Error("No se recibió una URL válida del servicio de verificación de identidad.");
  }
  return { url: urlFinal, sessionId: respuesta?.session_id ?? respuesta?.sessionId };
}

/**
 * Consulta la última verificación de identidad Didit registrada para el usuario actual.
 */
export async function obtenerEstadoVerificacionDiditUsuario(cliente: Cliente, sessionId?: string) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) return null;

  const usuario = await buscarUsuarioPorAuthId(cliente, sesion.user.id);
  if (!usuario) return null;

  let consulta = cliente
    .from("verificaciones_identidad_didit")
    .select("id, session_id, workflow_id, estado, decision, procesado_en, creado_en")
    .eq("usuario_id", usuario.id);

  if (sessionId) consulta = consulta.eq("session_id", sessionId);

  const { data, error } = await consulta.order("creado_en", { ascending: false }).limit(1).maybeSingle();

  if (error) {
    console.error("Error consultando verificación Didit del usuario", error.message);
    return null;
  }
  return data;
}

/**
 * REGLA DE DOMINIO — IDENTIDAD Y FACTURACIÓN (PR-05 / FASE 5):
 * - auth.users.email = Identidad de acceso (login, recuperación de contraseña y avisos de seguridad).
 * - usuarios.correo_facturacion = Destino fiscal (CFDI, facturación y documentación contable).
 *
 * PROHIBIDO: Usar correo_facturacion como fallback o destino de recuperación de acceso.
 * PROHIBIDO: Usar auth.users.email como fallback para timbrado fiscal.
 */

export interface ResultadoRestablecimientoPassword {
  email: string;
}

/**
 * Solicita el restablecimiento de contraseña para el usuario autenticado actual.
 * Obtiene estrictamente el email de acceso desde auth.getUser().user.email.
 * correo_facturacion se ignora por completo para flujos de identidad de acceso.
 */
export async function solicitarRestablecimientoPasswordUsuario(
  cliente: Cliente,
  redirectTo?: string
): Promise<ResultadoRestablecimientoPassword> {
  const { data: sesion, error: errorSesion } = await cliente.auth.getUser();
  if (errorSesion) throw errorSesion;

  const emailAuth = sesion?.user?.email?.trim();
  if (!emailAuth) {
    throw new Error("No se encontró un correo de autenticación válido para esta cuenta.");
  }

  const { error } = await cliente.auth.resetPasswordForEmail(emailAuth, {
    redirectTo:
      redirectTo ??
      (typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?type=recovery&next=/nueva-password`
        : undefined)
  });

  if (error) throw error;
  return { email: emailAuth };
}

/**
 * PR-07 P1/P2 — Registro explícito de consentimiento del usuario.
 * Separa creación de perfil de registro de consentimiento.
 * Nunca rellenar como default: requiere acción explícita, versión concreta,
 * timestamp real, canal/origen y auditoría.
 */
export interface RegistrarConsentimientoUsuarioParams {
  version: number;
  canal: "web" | "android" | "ios";
  versionApp: string;
  aceptadoEn?: string; // ISO, por defecto now()
}

export async function registrarConsentimientoUsuario(
  cliente: Cliente,
  params: RegistrarConsentimientoUsuarioParams
): Promise<{ version: number; aceptado_en: string }> {
  const { version, canal, versionApp, aceptadoEn } = params;

  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Versión de términos inválida.");
  }
  if (!["web", "android", "ios"].includes(canal)) {
    throw new Error("Canal de aceptación inválido.");
  }
  if (!versionApp || versionApp.trim().length < 1 || versionApp.trim().length > 40) {
    throw new Error("Versión de app inválida.");
  }

  const aceptado = aceptadoEn ?? new Date().toISOString();

  // Validar que la versión existe y está vigente
  const { data: versionRow, error: errorVersion } = await cliente
    .from("versiones_documento_consentimiento")
    .select("version, hash_documento")
    .eq("tipo_documento", "terminos_servicio")
    .eq("version", version)
    .maybeSingle();

  if (errorVersion) throw errorVersion;
  if (!versionRow) {
    throw new Error(`La versión ${version} de términos no está vigente.`);
  }

  // Intentar RPC si existe (producción), fallback a inserción directa para tests/migración pendiente
  const { data: rpcData, error: rpcError } = await cliente.rpc("registrar_consentimiento_usuario" as never, {
    p_version: version,
    p_canal: canal,
    p_version_app: versionApp.trim(),
    p_aceptado_en: aceptado,
  } as never);

  if (!rpcError && rpcData) {
    return rpcData as { version: number; aceptado_en: string };
  }

  // Fallback: inserción directa + actualización + auditoría (para entornos sin RPC migrado)
  if (rpcError && !String(rpcError.message ?? "").includes("does not exist") && !String((rpcError as { code?: string })?.code ?? "").includes("42883")) {
    throw rpcError;
  }

  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Sin sesión activa.");

  const usuario = await buscarUsuarioPorAuthId(cliente, sesion.user.id);
  if (!usuario) throw new Error("No se encontró el usuario autenticado.");

  // Obtener hashes vigentes
  const { data: versiones, error: errorVersiones } = await cliente
    .from("versiones_documento_consentimiento")
    .select("tipo_documento, version, hash_documento")
    .in("tipo_documento", ["terminos_servicio", "aviso_privacidad"])
    .eq("version", version);

  if (errorVersiones) throw errorVersiones;
  const hashTerminos = versiones?.find((v: { tipo_documento: string }) => v.tipo_documento === "terminos_servicio")?.hash_documento;
  const hashPrivacidad = versiones?.find((v: { tipo_documento: string }) => v.tipo_documento === "aviso_privacidad")?.hash_documento;

  if (!hashTerminos || !hashPrivacidad) {
    throw new Error("No se encontraron hashes vigentes para los documentos de consentimiento.");
  }

  for (const [tipo, hash] of [
    ["terminos_servicio", hashTerminos],
    ["aviso_privacidad", hashPrivacidad],
  ] as const) {
    const { error: errorInsert } = await cliente.from("consentimientos_usuario").insert({
      auth_user_id: sesion.user.id,
      solicitud_id: null,
      tipo_documento: tipo,
      version,
      canal,
      version_app: versionApp.trim(),
      hash_documento: hash,
      // aceptado_en se genera por default now(), pero si se pasó explícito lo usamos via RPC; para fallback usamos now()
    } as never);
    // Ignorar conflicto de unicidad (ya aceptado)
    if (errorInsert && !String(errorInsert.message).includes("duplicate") && !(errorInsert as { code?: string }).code?.includes("23505")) {
      throw errorInsert;
    }
  }

  const { error: errorUpdate } = await cliente
    .from("usuarios")
    .update({
      version_terminos_aceptada: version,
      terminos_aceptados_en: aceptado,
    } as never)
    .eq("id", usuario.id);

  if (errorUpdate) throw errorUpdate;

  await registrarEvento(cliente, "aceptacion_terminos" as never, "usuario" as never, usuario.id, {
    version_terminos_aceptada: version,
    terminos_aceptados_en: aceptado,
    canal,
    version_app: versionApp.trim(),
  } as never);

  return { version, aceptado_en: aceptado };
}

