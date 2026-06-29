import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

type Cliente = SupabaseClient<Database>;
type UsuarioRow = Database["public"]["Tables"]["usuarios"]["Row"];

function tipoCuentaDesdeMetadata(valor: unknown): "personal" | "empresa" {
  return valor === "empresa" ? "empresa" : "personal";
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
  const { data: creado, error: errorInsert } = await cliente
    .from("usuarios")
    .insert({
      auth_user_id: sesion.user.id,
      tipo_cuenta: tipoCuenta,
      rol: tipoCuenta === "empresa" ? "titular_empresa" : "personal",
      estado_verificacion: "pendiente",
      telefono: typeof sesion.user.user_metadata?.telefono === "string" ? sesion.user.user_metadata.telefono : null,
      nombre: typeof sesion.user.user_metadata?.nombre === "string" ? sesion.user.user_metadata.nombre : null
    })
    .select("*")
    .single();

  if (!errorInsert) return creado;

  const usuarioCreadoEnParalelo = await buscarUsuarioPorAuthId(cliente, sesion.user.id);
  if (usuarioCreadoEnParalelo) return usuarioCreadoEnParalelo;

  throw errorInsert;
}
