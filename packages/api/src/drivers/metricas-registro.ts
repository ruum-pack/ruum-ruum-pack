import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import { numeroMetrica, numeroMetricaNullable, objetoMetrica } from "../operations/infrastructure/metricas";

type Cliente = SupabaseClient<Database>;

export interface MetricasRegistroConductor {
  periodo: { desde: string; hasta: string };
  filtros?: { zona: string | null; fuente: string | null; empresaId: string | null };
  abandonoPorPaso: Array<{ paso: number; total: number }>;
  erroresOtp: number;
  erroresRpc: number;
  fallosDocumentos: number;
  tiempoPromedioRegistroSegundos: number | null;
  tiempoPromedioRevisionSegundos: number | null;
  documentosRechazadosPorTipo: Array<{ tipo: string; total: number }>;
  solicitudesIniciadas: number;
  solicitudesEnviadas: number;
  conversionEnvioPct: number;
  comparacion: { periodoAnterior: { desde: string; hasta: string }; metricas: Record<string, number> };
  detalle: Array<{
    clave: string;
    nombre: string;
    valor: number | null;
    formula: string;
    consultaReferencia: string;
    explicacion: string;
    meta: number | null;
    operadorMeta: "max" | "min" | null;
    alerta: boolean;
    severidad: "critica" | "alta" | "media" | null;
  }>;
  segmentos: Record<"zona" | "fuente" | "empresa", Array<{
    segmento: string;
    iniciadas: number;
    enviadas: number;
    conversionEnvioPct: number;
    erroresOtp: number;
    erroresRpc: number;
    fallosDocumentos: number;
  }>>;
  calidadDatos: { eventosTardios: number; eventosDuplicados: number; nota: string };
  alertas: Array<{ clave: string; nombre: string; valor: number; meta: number; severidad: "critica" | "alta" | "media" }>;
  exportacion: { recurso: string; formato: string; requierePermiso: string };
}

/** RT-27 — agregado calculado por PostgreSQL; el cliente no lee eventos crudos. */
export async function obtenerMetricasRegistroConductor(
  cliente: Cliente,
  desde: string,
  hasta: string,
  filtros: { zona?: string; fuente?: string; empresaId?: string } = {}
): Promise<MetricasRegistroConductor> {
  const rpc = cliente.rpc.bind(cliente) as unknown as (
    fn: "obtener_metricas_registro_conductor_v2",
    args: { p_desde: string; p_hasta: string; p_zona: string | null; p_fuente: string | null; p_empresa_id: string | null }
  ) => Promise<{ data: unknown; error: Error | null }>;
  const { data, error } = await rpc("obtener_metricas_registro_conductor_v2", {
    p_desde: desde,
    p_hasta: hasta,
    p_zona: filtros.zona ?? null,
    p_fuente: filtros.fuente ?? null,
    p_empresa_id: filtros.empresaId ?? null
  });
  if (error) throw error;

  const raiz = objetoMetrica(data);
  const periodo = objetoMetrica(raiz.periodo);
  const filtrosRespuesta = objetoMetrica(raiz.filtros);
  const metricas = objetoMetrica(raiz.metricas);
  const comparacion = objetoMetrica(raiz.comparacion);
  const periodoAnterior = objetoMetrica(comparacion.periodo_anterior);
  const metricasAnteriores = objetoMetrica(comparacion.metricas);
  const segmentos = objetoMetrica(raiz.segmentos);
  const calidadDatos = objetoMetrica(raiz.calidad_datos);
  const abandonos = Array.isArray(raiz.abandono_por_paso) ? raiz.abandono_por_paso : [];
  const rechazados = Array.isArray(raiz.documentos_rechazados_por_tipo) ? raiz.documentos_rechazados_por_tipo : [];
  const detalle = Array.isArray(raiz.detalle) ? raiz.detalle : [];
  const alertas = Array.isArray(raiz.alertas) ? raiz.alertas : [];
  const exportacion = objetoMetrica(raiz.exportacion);

  return {
    periodo: { desde: String(periodo.desde ?? desde), hasta: String(periodo.hasta ?? hasta) },
    filtros: {
      zona: typeof filtrosRespuesta.zona === "string" ? filtrosRespuesta.zona : null,
      fuente: typeof filtrosRespuesta.fuente === "string" ? filtrosRespuesta.fuente : null,
      empresaId: typeof filtrosRespuesta.empresa_id === "string" ? filtrosRespuesta.empresa_id : null
    },
    abandonoPorPaso: abandonos.map(objetoMetrica).map((fila) => ({
      paso: numeroMetrica(fila.paso),
      total: numeroMetrica(fila.total)
    })),
    erroresOtp: numeroMetrica(metricas.errores_otp),
    erroresRpc: numeroMetrica(metricas.errores_rpc),
    fallosDocumentos: numeroMetrica(metricas.fallos_documentos),
    tiempoPromedioRegistroSegundos: numeroMetricaNullable(metricas.tiempo_promedio_registro_segundos),
    tiempoPromedioRevisionSegundos: numeroMetricaNullable(metricas.tiempo_promedio_revision_segundos),
    documentosRechazadosPorTipo: rechazados.map(objetoMetrica).map((fila) => ({
      tipo: String(fila.tipo ?? "desconocido"),
      total: numeroMetrica(fila.total)
    })),
    solicitudesIniciadas: numeroMetrica(metricas.solicitudes_iniciadas),
    solicitudesEnviadas: numeroMetrica(metricas.solicitudes_enviadas),
    conversionEnvioPct: numeroMetrica(metricas.conversion_envio_pct),
    comparacion: {
      periodoAnterior: {
        desde: String(periodoAnterior.desde ?? ""),
        hasta: String(periodoAnterior.hasta ?? "")
      },
      metricas: Object.fromEntries(Object.entries(metricasAnteriores).map(([clave, valor]) => [clave, numeroMetrica(valor)]))
    },
    detalle: detalle.map(objetoMetrica).map((fila) => ({
      clave: String(fila.clave ?? ""),
      nombre: String(fila.nombre ?? ""),
      valor: fila.valor === null ? null : numeroMetrica(fila.valor),
      formula: String(fila.formula ?? ""),
      consultaReferencia: String(fila.consulta_referencia ?? ""),
      explicacion: String(fila.explicacion ?? ""),
      meta: fila.meta === null ? null : numeroMetrica(fila.meta),
      operadorMeta: fila.operador_meta === "max" || fila.operador_meta === "min" ? fila.operador_meta : null,
      alerta: Boolean(fila.alerta),
      severidad: fila.severidad === "critica" || fila.severidad === "alta" || fila.severidad === "media" ? fila.severidad : null
    })),
    segmentos: {
      zona: mapearSegmentoRegistro(segmentos.zona),
      fuente: mapearSegmentoRegistro(segmentos.fuente),
      empresa: mapearSegmentoRegistro(segmentos.empresa)
    },
    calidadDatos: {
      eventosTardios: numeroMetrica(calidadDatos.eventos_tardios),
      eventosDuplicados: numeroMetrica(calidadDatos.eventos_duplicados),
      nota: String(calidadDatos.nota ?? "")
    },
    alertas: alertas.map(objetoMetrica).map((fila) => ({
      clave: String(fila.clave ?? ""),
      nombre: String(fila.nombre ?? ""),
      valor: numeroMetrica(fila.valor),
      meta: numeroMetrica(fila.meta),
      severidad: fila.severidad === "critica" || fila.severidad === "alta" || fila.severidad === "media" ? fila.severidad : "media"
    })),
    exportacion: {
      recurso: String(exportacion.recurso ?? "metricas_registro_conductor"),
      formato: String(exportacion.formato ?? "csv"),
      requierePermiso: String(exportacion.requiere_permiso ?? "exportaciones:crear")
    }
  };
}

function mapearSegmentoRegistro(valor: unknown) {
  const filas = Array.isArray(valor) ? valor : [];
  return filas.map(objetoMetrica).map((fila) => ({
    segmento: String(fila.segmento ?? "sin_segmento"),
    iniciadas: numeroMetrica(fila.iniciadas),
    enviadas: numeroMetrica(fila.enviadas),
    conversionEnvioPct: numeroMetrica(fila.conversion_envio_pct),
    erroresOtp: numeroMetrica(fila.errores_otp),
    erroresRpc: numeroMetrica(fila.errores_rpc),
    fallosDocumentos: numeroMetrica(fila.fallos_documentos)
  }));
}
