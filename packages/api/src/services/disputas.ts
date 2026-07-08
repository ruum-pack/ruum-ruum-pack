import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { puedeAbrirseDisputa } from "@ruum/shared/rules";

type Cliente = SupabaseClient<Database>;
type TipoDisputa = Database["public"]["Enums"]["tipo_disputa"];
type AbiertaPor = Database["public"]["Enums"]["abierta_por_actor"];

async function actorActual(cliente: Cliente): Promise<AbiertaPor> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) throw new Error("No hay sesión para abrir disputa.");

  const [usuario, conductor] = await Promise.all([
    cliente.from("usuarios").select("id").eq("auth_user_id", sesion.user.id).maybeSingle(),
    cliente.from("conductores").select("id").eq("auth_user_id", sesion.user.id).maybeSingle()
  ]);

  if (usuario.error) throw usuario.error;
  if (conductor.error) throw conductor.error;
  if (usuario.data) return "usuario";
  if (conductor.data) return "conductor";
  throw new Error("La sesión actual no corresponde a un usuario o conductor.");
}

export async function abrirDisputa(
  cliente: Cliente,
  trasladoId: string,
  tipo: TipoDisputa,
  descripcion: string
) {
  const descripcionLimpia = descripcion.trim();
  if (descripcionLimpia.length < 10) {
    throw new Error("Describe la disputa con al menos 10 caracteres.");
  }

  const { data: traslado, error: errorTraslado } = await cliente
    .from("traslados")
    .select("id, actualizado_en")
    .eq("id", trasladoId)
    .maybeSingle();

  if (errorTraslado) throw errorTraslado;
  if (!traslado) throw new Error("No se encontró el traslado para abrir disputa.");

  const horasDesdeCierre = (Date.now() - new Date(traslado.actualizado_en).getTime()) / (1000 * 60 * 60);
  if (!puedeAbrirseDisputa(horasDesdeCierre)) {
    throw new Error("El plazo de 72 horas para abrir una disputa ya venció.");
  }

  const abiertaPor = await actorActual(cliente);
  const { data, error } = await cliente.rpc("abrir_disputa_traslado", {
    p_traslado_id: trasladoId,
    p_abierta_por: abiertaPor,
    p_tipo: tipo,
    p_descripcion: descripcionLimpia
  });

  if (error) throw error;
  return data;
}
