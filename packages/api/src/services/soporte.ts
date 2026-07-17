import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { registrarEvento } from "./auditoria";

type Cliente = SupabaseClient<Database>;

export async function activarSoporteEmergenciaConductor(cliente: Cliente, trasladoId: string) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) {
    throw new Error("Debes iniciar sesión como conductor para activar emergencia.");
  }

  const { data: conductor, error: errorConductor } = await cliente
    .from("conductores")
    .select("id")
    .eq("auth_user_id", sesion.user.id)
    .maybeSingle();

  if (errorConductor) throw errorConductor;
  if (!conductor) throw new Error("No se encontró el conductor autenticado.");

  const { data: traslado, error: errorTraslado } = await cliente
    .from("traslados")
    .select("id")
    .eq("id", trasladoId)
    .eq("conductor_id", conductor.id)
    .maybeSingle();

  if (errorTraslado) throw errorTraslado;
  if (!traslado) throw new Error("Este traslado no está asignado al conductor autenticado.");

  await registrarEvento(cliente, "activacion_soporte_emergencia", "conductor", conductor.id, {
    traslado_id: trasladoId,
    prioridad: "alta",
    canal: "911",
    origen: "app-conductor"
  });
}

export async function registrarInteraccionPanelEmergenciaConductor(
  cliente: Cliente,
  trasladoId: string,
  accion: "apertura" | "seleccion",
  opcion: string,
  datos: Record<string, string | number | boolean | null> = {}
) {
  const { data: sesion } = await cliente.auth.getUser();
  if (!sesion.user) {
    throw new Error("Debes iniciar sesión como conductor para usar el panel de emergencia.");
  }

  const { data: conductor, error: errorConductor } = await cliente
    .from("conductores")
    .select("id")
    .eq("auth_user_id", sesion.user.id)
    .maybeSingle();

  if (errorConductor) throw errorConductor;
  if (!conductor) throw new Error("No se encontró el conductor autenticado.");

  const { data: traslado, error: errorTraslado } = await cliente
    .from("traslados")
    .select("id")
    .eq("id", trasladoId)
    .eq("conductor_id", conductor.id)
    .maybeSingle();

  if (errorTraslado) throw errorTraslado;
  if (!traslado) throw new Error("Este traslado no está asignado al conductor autenticado.");

  await registrarEvento(cliente, "modificacion_traslado_activo", "conductor", conductor.id, {
    traslado_id: trasladoId,
    accion: `panel_emergencia_${accion}`,
    opcion,
    origen: "app-conductor",
    ...datos
  });
}
