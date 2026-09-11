import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, FotoEvidencia } from "@ruum/shared/types";
import { transicionValida } from "@ruum/shared/states";
import { evidenciaCompleta } from "@ruum/shared/rules";
import { clasificarTrasladoFallido } from "@ruum/shared/rules";
import { assertAdminAnyPermission, assertAdminPermission } from "../services/permisos-admin";
import { registrarEvento } from "../services/auditoria";
import { withIdempotentRetry } from "../operations/infrastructure/retry";

type Cliente = SupabaseClient<Database>;
type EvidenciaRow = Database["public"]["Tables"]["evidencia_fotos"]["Row"];
type TipoEvidencia = Database["public"]["Enums"]["tipo_evidencia"];
type EstadoTraslado = Database["public"]["Enums"]["estado_traslado"];
type TrasladoRow = Database["public"]["Tables"]["traslados"]["Row"];
type CausaFallido = Database["public"]["Enums"]["causa_fallido"];

function aFotoEvidencia(fila: EvidenciaRow): FotoEvidencia {
  return {
    id: fila.id,
    traslado_id: fila.traslado_id,
    tipo: fila.tipo,
    angulo: fila.angulo,
    ...(fila.url ? { url: fila.url } : {}),
    ...(fila.local_path ? { local_path: fila.local_path } : {}),
    timestamp: fila.capturada_en,
    ...(fila.lat !== null ? { lat: fila.lat } : {}),
    ...(fila.lng !== null ? { lng: fila.lng } : {}),
    sincronizada: fila.sincronizada
  };
}

async function validarEvidenciaCompletaParaAdmin(cliente: Cliente, trasladoId: string, tipo: TipoEvidencia) {
  const { data, error } = await cliente
    .from("evidencia_fotos")
    .select("*")
    .eq("traslado_id", trasladoId)
    .eq("tipo", tipo);

  if (error) throw error;

  const resultado = evidenciaCompleta((data ?? []).map(aFotoEvidencia), tipo);
  if (!resultado.completa) {
    throw new Error(`No se puede cambiar a evidencia_${tipo}_completada: faltan ${resultado.angulosFaltantes.join(", ")}.`);
  }
}

async function validarPagoCompletadoParaAdmin(cliente: Cliente, trasladoId: string) {
  const { data, error } = await cliente
    .from("pagos")
    .select("id")
    .eq("traslado_id", trasladoId)
    .eq("estado", "completado")
    .limit(1);

  if (error) throw error;

  if ((data ?? []).length === 0) {
    throw new Error("No se puede cambiar a pago_completado: no existe un pago con estado completado para este viaje.");
  }
}

async function validarPrerequisitosEstatusAdmin(cliente: Cliente, trasladoId: string, nuevoEstado: EstadoTraslado) {
  if (nuevoEstado === "evidencia_inicial_completada") {
    await validarEvidenciaCompletaParaAdmin(cliente, trasladoId, "inicial");
  }
  if (nuevoEstado === "evidencia_final_completada") {
    await validarEvidenciaCompletaParaAdmin(cliente, trasladoId, "final");
  }
  if (nuevoEstado === "pago_completado") {
    await validarPagoCompletadoParaAdmin(cliente, trasladoId);
  }
}

export async function asignarConductorAdmin(
  cliente: Cliente,
  trasladoId: string,
  conductorId: string,
  estadoActual: EstadoTraslado
) {
  if (estadoActual !== "pendiente_de_conductor" && estadoActual !== "conductor_asignado") {
    throw new Error("La asignación manual solo está disponible cuando el traslado espera conductor o requiere reasignación antes de iniciar.");
  }
  await assertAdminPermission(cliente, "viajes:gestionar");
  const { error } = await cliente.rpc("admin_asigna_conductor", {
    p_traslado_id: trasladoId,
    p_conductor_id: conductorId
  });
  if (error) throw error;
}

/**
 * PRD §17.4 — "cambiar estatus". Valida contra TRANSICIONES (mismo mapa que
 * el trigger de Postgres en 0005) antes de intentarlo, para dar un mensaje
 * claro en vez de depender solo del error crudo de la base. También valida
 * los prerequisitos de contenido real (evidencia completa, pago completado)
 * antes de aplicar el cambio — cierra el hueco donde este selector genérico
 * podía marcar evidencia_*_completada o pago_completado sin que existiera
 * evidencia o pago real detrás (mismo criterio que ya aplicaban
 * evidencia.ts::confirmarEvidenciaCompleta y el webhook de Stripe).
 */
export const ESTADOS_CRITICOS_TRASLADO: readonly EstadoTraslado[] = ["pago_completado"];

export async function cambiarEstatusAdmin(
  cliente: Cliente,
  trasladoId: string,
  estadoActual: EstadoTraslado,
  nuevoEstado: EstadoTraslado,
  aprobacionId?: string,
  versionEsperada?: number
) {
  await assertAdminPermission(cliente, "viajes:gestionar");

  if (!transicionValida(estadoActual, nuevoEstado)) {
    throw new Error(`Transición no permitida: ${estadoActual} -> ${nuevoEstado}`);
  }

  return withIdempotentRetry(async () => {
    const rpc = cliente.rpc.bind(cliente) as unknown as (
      fn: "admin_cambiar_estado_traslado",
      args: { p_traslado_id: string; p_nuevo_estado: string; p_version_esperada?: number; p_aprobacion_id?: string }
    ) => Promise<{ data: { ejecutado?: boolean; version?: number } | null; error: unknown }>;
    const { data, error } = await rpc("admin_cambiar_estado_traslado", {
      p_traslado_id: trasladoId,
      p_nuevo_estado: nuevoEstado,
      p_version_esperada: versionEsperada,
      p_aprobacion_id: aprobacionId
    });
    if (error) throw error;
    if (!data?.ejecutado) throw new Error("No se pudo cambiar el estado del traslado.");
  });
}

export async function marcarTrasladoFallido(cliente: Cliente, trasladoId: string, causa: CausaFallido) {
  await assertAdminPermission(cliente, "viajes:gestionar");
  const resultado = clasificarTrasladoFallido(causa);

  const { error } = await cliente.rpc("admin_marca_traslado_fallido", {
    p_traslado_id: trasladoId,
    p_causa: causa,
    p_cargo_aplica_cliente: resultado.cargo_aplica_cliente,
    p_requiere_reagendamiento: resultado.requiere_reagendamiento,
    p_porcentaje_descuento_segundo_intento: (resultado.porcentaje_descuento_segundo_intento ?? null) as never,
    p_mensaje: resultado.mensaje
  });

  if (error) throw error;

  return resultado;
}
