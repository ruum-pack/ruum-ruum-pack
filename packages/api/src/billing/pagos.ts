import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { numeroMetrica, objetoMetrica } from "../operations/infrastructure/metricas";

type Cliente = SupabaseClient<Database>;
type PagoRow = Database["public"]["Tables"]["pagos"]["Row"];
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];
type PayoutRow = Database["public"]["Tables"]["payouts_conductor"]["Row"];
type DatosBancariosConductorRow = Database["public"]["Tables"]["datos_bancarios_conductor"]["Row"];
type ConductorRow = Database["public"]["Tables"]["conductores"]["Row"];

export interface DatosPagosAdmin {
  pagosUsuarios: PagoRow[];
  pasaportes: PasaporteRow[];
  payoutsConductores: PayoutRow[];
  datosBancariosConductores: DatosBancariosConductorRow[];
  conductores: ConductorRow[];
}

export interface FinanzasTrasladoAdmin {
  precioOperativo: number;
  ingresosCobrados: number;
  gastosOperativos: number;
  pagoConductor: number;
  margenEstimado: number;
  margenContraPrecio: number;
  corteEn: string;
}

export async function listarPagosAdmin(cliente: Cliente): Promise<DatosPagosAdmin> {
  await assertAdminPermission(cliente, "pagos:leer");
  const [pagos, pasaportes, payouts, datosBancarios, conductores] = await Promise.all([
    cliente.from("pagos").select("*").order("registrado_en", { ascending: false }),
    cliente.from("pasaporte_digital").select("*").order("creado_en", { ascending: false }),
    cliente.from("payouts_conductor").select("*").order("periodo_inicio", { ascending: false }),
    cliente.from("datos_bancarios_conductor").select("*").order("actualizado_en", { ascending: false }),
    cliente.from("conductores").select("*").order("creado_en", { ascending: false })
  ]);

  for (const resultado of [pagos, pasaportes, payouts, datosBancarios, conductores]) {
    if (resultado.error) throw resultado.error;
  }

  return {
    pagosUsuarios: pagos.data ?? [],
    pasaportes: pasaportes.data ?? [],
    payoutsConductores: payouts.data ?? [],
    datosBancariosConductores: datosBancarios.data ?? [],
    conductores: conductores.data ?? []
  };
}

export async function obtenerFinanzasTrasladoAdmin(cliente: Cliente, trasladoId: string): Promise<FinanzasTrasladoAdmin> {
  await assertAdminPermission(cliente, "pagos:leer");
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_finanzas_traslado",
    args: { p_traslado_id: string }
  ) => Promise<{ data: unknown; error: unknown }>;
  const { data, error } = await rpc("admin_finanzas_traslado", { p_traslado_id: trasladoId });
  if (error) throw error;
  const fila = objetoMetrica(data);
  return {
    precioOperativo: numeroMetrica(fila.precio_operativo),
    ingresosCobrados: numeroMetrica(fila.ingresos_cobrados),
    gastosOperativos: numeroMetrica(fila.gastos_operativos),
    pagoConductor: numeroMetrica(fila.pago_conductor),
    margenEstimado: numeroMetrica(fila.margen_estimado),
    margenContraPrecio: numeroMetrica(fila.margen_contra_precio),
    corteEn: String(fila.corte_en ?? "")
  };
}

export async function ajustarPrecioFinalAdmin(
  cliente: Cliente,
  trasladoId: string,
  precioFinal: number,
  aprobacionId?: string
) {
  await assertAdminPermission(cliente, "tarifas:editar");
  if (!Number.isFinite(precioFinal) || precioFinal < 0) {
    throw new Error("La tarifa final debe ser un número válido mayor o igual a 0.");
  }
  if (!aprobacionId) {
    throw new Error("Esta operación requiere una aprobación dual válida (aprobacionId).");
  }

  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "admin_ajustar_precio_final",
    args: { p_aprobacion_id: string; p_traslado_id: string; p_precio_final: number }
  ) => Promise<{ data: { ejecutado?: boolean } | null; error: unknown }>;
  const { data, error } = await rpc("admin_ajustar_precio_final", {
    p_aprobacion_id: aprobacionId,
    p_traslado_id: trasladoId,
    p_precio_final: precioFinal
  });
  if (error) throw error;
  if (!data?.ejecutado) throw new Error("No se pudo ajustar el precio final.");
}
