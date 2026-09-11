import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminPermission } from "../../services/permisos-admin";
import { type AuditoriaOperacionMasivaAdmin } from "../domain/tipos";
import { numeroMetrica, objetoMetrica } from "../infrastructure/metricas";

type Cliente = SupabaseClient<Database>;

export async function listarAuditoriaOperativaTraslados(cliente: Cliente): Promise<AuditoriaOperacionMasivaAdmin[]> {
  await assertAdminPermission(cliente, "auditoria:leer");
  const { data, error } = await cliente
    .from("registro_auditoria")
    .select("id, evento, datos, timestamp")
    .eq("evento", "modificacion_masiva_traslados" as never)
    .order("timestamp", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((fila) => {
    const datos = objetoMetrica(fila.datos);
    const resultados = Array.isArray(datos.resultados) ? datos.resultados.map(objetoMetrica) : [];
    return {
      id: fila.id,
      accion: String(datos.accion ?? fila.evento),
      afectados: numeroMetrica(datos.total ?? datos.afectados),
      exitosos: numeroMetrica(datos.aplicados ?? datos.exitosos),
      omitidos: numeroMetrica(datos.omitidos),
      bloqueados: numeroMetrica(datos.bloqueados),
      timestamp: fila.timestamp,
      detalle: resultados.map((resultado) => `${String(resultado.traslado_id ?? "").slice(0, 8).toUpperCase()}: ${String(resultado.detalle ?? "")}`).join(" | "),
      folios: resultados.map((resultado) => String(resultado.traslado_id ?? "").slice(0, 8).toUpperCase()).filter(Boolean)
    };
  });
}
