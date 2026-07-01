import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;
type TipoIncidencia = Database["public"]["Enums"]["tipo_incidencia"];
type MomentoIncidencia = Database["public"]["Enums"]["momento_incidencia"];
type ActorReporte = Database["public"]["Enums"]["actor_reporte"];

async function resolverActorReporte(cliente: Cliente, trasladoId: string): Promise<{ actor: ActorReporte; actorId: string }> {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) {
    throw new Error("Debes iniciar sesión para reportar una incidencia.");
  }

  const [{ data: usuario, error: errorUsuario }, { data: conductor, error: errorConductor }] = await Promise.all([
    cliente.from("usuarios").select("id").eq("auth_user_id", sesion.user.id).maybeSingle(),
    cliente.from("conductores").select("id").eq("auth_user_id", sesion.user.id).maybeSingle()
  ]);

  if (errorUsuario) throw errorUsuario;
  if (errorConductor) throw errorConductor;

  if (conductor) {
    const { data, error } = await cliente
      .from("traslados")
      .select("id")
      .eq("id", trasladoId)
      .eq("conductor_id", conductor.id)
      .maybeSingle();
    if (error) throw error;
    if (data) return { actor: "conductor", actorId: conductor.id };
  }

  if (usuario) {
    const { data, error } = await cliente
      .from("traslados")
      .select("id")
      .eq("id", trasladoId)
      .eq("usuario_id", usuario.id)
      .maybeSingle();
    if (error) throw error;
    if (data) return { actor: "usuario", actorId: usuario.id };
  }

  throw new Error("No tienes acceso para reportar incidencias en este traslado.");
}

export async function reportarIncidencia(
  cliente: Cliente,
  trasladoId: string,
  tipo: TipoIncidencia,
  momento: MomentoIncidencia,
  descripcion: string
) {
  const texto = descripcion.trim();
  if (texto.length < 10) {
    throw new Error("Describe la incidencia con al menos 10 caracteres.");
  }

  const { actor, actorId } = await resolverActorReporte(cliente, trasladoId);
  const { data, error } = await cliente
    .from("incidencias")
    .insert({
      traslado_id: trasladoId,
      tipo,
      momento,
      reportada_por: actor,
      descripcion: texto
    })
    .select("id")
    .single();

  if (error) throw error;

  await registrarEvento(cliente, "reporte_incidencia", actor, actorId, {
    traslado_id: trasladoId,
    incidencia_id: data.id,
    tipo,
    momento
  });

  return data;
}

export async function crearIncidenciaSistemaDanoNoReportado(cliente: Cliente, trasladoId: string, descripcion: string) {
  const { data, error } = await cliente.rpc("crear_incidencia_sistema_dano_no_reportado", {
    p_traslado_id: trasladoId,
    p_descripcion: descripcion
  });

  if (error) throw error;
  return data;
}
