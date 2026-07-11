/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import { createClient } from "npm:@supabase/supabase-js@2";
import { TAMANO_MAXIMO, validarDocumento } from "../_shared/validacion-documento.ts";
import { leerFormularioLimitado } from "../_shared/multipart-limitado.ts";

const BUCKET = "documentos-identidad";
const FORMATOS_IDENTIDAD = new Set(["jpeg", "png", "pdf"] as const);
type RegistroIdentidad = {
  ruta: string;
  estado: "en_revision";
  subido_en: string;
  ruta_anterior: string | null;
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function codigoSeguro(error: unknown) {
  if (!error || typeof error !== "object") return "desconocido";
  const valor = error as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof valor.code === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(valor.code)) return valor.code;
  if (typeof valor.status === "number") return `http_${valor.status}`;
  if (typeof valor.name === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(valor.name)) return valor.name;
  return "desconocido";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Inicia sesión para subir tu identificación." }, 401);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !anon || !serviceKey) return json({ error: "El servicio documental no está configurado." }, 500);

  const usuario = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const servicio = createClient(url, serviceKey);
  const { data: sesion, error: errorSesion } = await usuario.auth.getUser();
  if (errorSesion || !sesion.user) return json({ error: "La sesión no es válida." }, 401);

  let form: FormData;
  try {
    form = await leerFormularioLimitado(req, TAMANO_MAXIMO);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Formulario inválido." }, 413);
  }
  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) return json({ error: "Falta el archivo de identidad." }, 400);

  let validado;
  try {
    validado = validarDocumento(new Uint8Array(await archivo.arrayBuffer()), archivo.name, FORMATOS_IDENTIDAD);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Archivo inválido." }, 422);
  }

  const contenidoHash = new ArrayBuffer(validado.bytes.byteLength);
  new Uint8Array(contenidoHash).set(validado.bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", contenidoHash));
  const sha256 = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const ruta = `${sesion.user.id}/${crypto.randomUUID()}.${validado.extension}`;

  const { data: perfil, error: errorPerfil } = await usuario.from("usuarios")
    .select("id").eq("auth_user_id", sesion.user.id).single();
  if (errorPerfil || !perfil) return json({ error: "No se encontró el perfil del usuario autenticado." }, 409);

  const { data: sello, error: errorSello } = await servicio.from("documentos_identidad_storage_validados").insert({
    ruta,
    auth_user_id: sesion.user.id,
    usuario_id: perfil.id,
    sha256,
    mime: validado.mime,
    tamano_bytes: validado.bytes.byteLength,
    expira_en: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  }).select("id").single();
  if (errorSello || !sello) {
    console.error("Error creando sello de identidad", { codigo: codigoSeguro(errorSello) });
    return json({ error: "No fue posible autorizar la carga validada." }, 500);
  }

  const { error: errorUpload } = await usuario.storage.from(BUCKET).upload(ruta, validado.bytes, {
    upsert: false,
    contentType: validado.mime,
    cacheControl: "3600"
  });
  if (errorUpload) {
    await servicio.from("documentos_identidad_storage_validados").delete().eq("ruta", ruta);
    return json({ error: `No fue posible almacenar el documento: ${errorUpload.message}` }, 500);
  }

  const { data: registroSinTipo, error: errorRpc } = await usuario.rpc("registrar_documento_identidad", {
    p_sello_id: sello.id,
    p_ruta: ruta,
    p_sha256: sha256
  }).single();
  const registro = registroSinTipo as RegistroIdentidad | null;
  if (errorRpc || !registro) {
    await servicio.storage.from(BUCKET).remove([ruta]);
    await servicio.from("documentos_identidad_storage_validados").delete().eq("ruta", ruta);
    return json({ error: errorRpc?.message ?? "La RPC no devolvió el documento registrado." }, 409);
  }

  let limpiezaPendiente = false;
  if (registro.ruta_anterior) {
    const { error: errorEliminar } = await servicio.storage.from(BUCKET).remove([registro.ruta_anterior]);
    if (errorEliminar) {
      limpiezaPendiente = true;
      const codigo = codigoSeguro(errorEliminar);
      console.error("PII anterior pendiente de eliminación", { codigo });
      await servicio.from("documentos_identidad_usuario").update({ error_eliminacion: codigo })
        .eq("ruta", registro.ruta_anterior);
    } else {
      await servicio.from("documentos_identidad_usuario").update({
        eliminado_storage_en: new Date().toISOString(), error_eliminacion: null
      }).eq("ruta", registro.ruta_anterior);
    }
  }

  return json({
    ruta: registro.ruta,
    estado: registro.estado,
    subidoEn: registro.subido_en,
    limpiezaPendiente
  }, 201);
});
