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
  const usuario = await obtenerUsuarioActual(cliente);
  if (!usuario) throw new Error("Sin sesión activa.");

  const datosUsuario = {
    rfc: datos.rfc,
    razon_social: datos.razon_social,
    regimen_fiscal: datos.regimen_fiscal,
    codigo_postal_fiscal: datos.codigo_postal_fiscal,
    uso_cfdi: datos.uso_cfdi,
    correo_facturacion: datos.correo_facturacion
  };

  const { error: errorUsuario } = await cliente
    .from("usuarios")
    .update(datosUsuario)
    .eq("id", usuario.id);

  if (errorUsuario) throw errorUsuario;

  if (usuario.empresa_id && usuario.rol === "titular_empresa") {
    const { error: errorEmpresa } = await cliente
      .from("empresas")
      .update(datos)
      .eq("id", usuario.empresa_id);

    if (errorEmpresa) throw errorEmpresa;
  }
}

export async function subirFotoPerfil(cliente: Cliente, archivo: File): Promise<string> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("Sin sesión activa.");

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${sesion.user.id}/perfil.${ext}`;
  const foto = await subirArchivoPerfil(cliente, "fotos-perfil", path, archivo);

  const { data } = cliente.storage.from(foto.bucket).getPublicUrl(foto.path);
  const fotoUrl = `${data.publicUrl}?v=${Date.now()}`;

  await actualizarPerfilUsuario(cliente, { foto_url: fotoUrl } as PerfilUsuarioActualizable);
  return fotoUrl;
}

async function subirArchivoPerfil(
  cliente: Cliente,
  bucket: string,
  path: string,
  archivo: File
): Promise<{ bucket: string; path: string }> {
  const { error } = await cliente.storage.from(bucket).upload(path, archivo, {
    upsert: true,
    contentType: archivo.type
  });

  if (!error) return { bucket, path };

  const mensaje = error.message.toLowerCase();
  if (bucket === "fotos-perfil" && mensaje.includes("bucket not found")) {
    const pathRespaldo = `perfiles/${path}`;
    const { error: errorRespaldo } = await cliente.storage.from("evidencia").upload(pathRespaldo, archivo, {
      upsert: true,
      contentType: archivo.type
    });
    if (errorRespaldo) throw errorRespaldo;
    return { bucket: "evidencia", path: pathRespaldo };
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
