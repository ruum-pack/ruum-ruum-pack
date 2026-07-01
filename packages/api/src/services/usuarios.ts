import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { VERSION_TERMINOS_VIGENTE } from "@ruum/shared/constants";
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
      version_terminos_aceptada: VERSION_TERMINOS_VIGENTE,
      terminos_aceptados_en: new Date().toISOString()
    })
    .select("*")
    .single();

  if (!errorInsert) return creado;

  const usuarioCreadoEnParalelo = await buscarUsuarioPorAuthId(cliente, sesion.user.id);
  if (usuarioCreadoEnParalelo) return usuarioCreadoEnParalelo;

  throw errorInsert;
}

/**
 * Registra que el usuario aceptó la versión actual de los términos.
 * Se llama después de signUp() como respaldo del trigger de alta.
 *
 * Se usa un UPDATE con .eq("auth_user_id", authUserId) en vez de la sesión
 * porque el trigger de 0024/0031 ya creó la fila en usuarios con ese id.
 */
export async function registrarAceptacionTerminos(
  cliente: Cliente,
  authUserId: string
): Promise<void> {
  const { error } = await cliente
    .from("usuarios")
    .update({
      version_terminos_aceptada: VERSION_TERMINOS_VIGENTE,
      terminos_aceptados_en: new Date().toISOString()
    })
    .eq("auth_user_id", authUserId);

  if (error) throw error;
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

/**
 * Sube el documento de identidad del usuario al bucket privado
 * "documentos-identidad" y guarda el path relativo en usuarios.
 */
export async function subirDocumentoIdentidad(cliente: Cliente, archivo: File): Promise<void> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Sin sesión activa.");

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${sesion.user.id}/identidad.${ext}`;

  const { error: errorStorage } = await cliente.storage
    .from("documentos-identidad")
    .upload(path, archivo, { upsert: true, contentType: archivo.type });

  if (errorStorage) throw errorStorage;

  const { data: usuario, error: errorUsuario } = await cliente
    .from("usuarios")
    .update({
      doc_identidad_url: path,
      doc_identidad_subido_en: new Date().toISOString(),
      estado_verificacion: "en_revision"
    })
    .eq("auth_user_id", sesion.user.id)
    .select("id")
    .single();

  if (errorUsuario) throw errorUsuario;

  await registrarEvento(cliente, "carga_documento_identidad", "usuario", usuario.id, {
    path,
    tipo_archivo: archivo.type
  });
}
