import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";
import {
  type EstadoTraslado,
  type IndicadorAccionableDashboard,
  type MetricasDashboard
} from "../domain/tipos";
import { listarExcepcionesCriticasAdmin } from "./excepciones";

type Cliente = SupabaseClient<Database>;

const ESTADOS_TERMINALES: EstadoTraslado[] = ["servicio_cerrado", "servicio_cancelado", "traslado_fallido"];

export async function obtenerMetricasDashboard(cliente: Cliente): Promise<MetricasDashboard> {
  const hoyInicio = new Date();
  hoyInicio.setHours(0, 0, 0, 0);

  const [activos, pendientes, cerradosHoy, conductoresActivos, incidencias] = await Promise.all([
    cliente.from("traslados").select("id", { count: "exact", head: true }).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("estado", "pendiente_de_conductor"),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "servicio_cerrado")
      .gte("actualizado_en", hoyInicio.toISOString()),
    cliente.from("conductores").select("id", { count: "exact", head: true }).eq("estado", "activo"),
    cliente.from("incidencias").select("id", { count: "exact", head: true }).eq("resuelta", false)
  ]);

  return {
    viajesActivos: activos.count ?? 0,
    pendientesAsignacion: pendientes.count ?? 0,
    cerradosHoy: cerradosHoy.count ?? 0,
    conductoresActivos: conductoresActivos.count ?? 0,
    incidenciasAbiertas: incidencias.count ?? 0
  };
}

function inicioDeHoy() {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

function porcentajeVariacion(actual: number, previo: number) {
  if (previo === 0) return actual === 0 ? 0 : 100;
  return Math.round(((actual - previo) / previo) * 100);
}

function severidadIndicador(valor: number, umbralCritico: number, umbralAtencion = Math.ceil(umbralCritico * 0.7)): IndicadorAccionableDashboard["severidad"] {
  if (valor >= umbralCritico) return "critico";
  if (valor >= umbralAtencion) return "atencion";
  return "normal";
}

export async function obtenerIndicadoresAccionablesDashboard(cliente: Cliente): Promise<IndicadorAccionableDashboard[]> {
  const ahora = new Date();
  const hoy = inicioDeHoy();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const hace48h = new Date(ahora.getTime() - 48 * 60 * 60 * 1000);
  const en60Min = new Date(ahora.getTime() + 60 * 60 * 1000);
  const ayerInicio = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

  const [
    activos,
    activosPrevios,
    inician60,
    sinAsignacion,
    sinAsignacionPrevio,
    cerradosHoy,
    cerradosAyer,
    conIncidencia,
    incidenciasPrevias,
    excepciones
  ] = await Promise.all([
    cliente.from("traslados").select("id", { count: "exact", head: true }).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente.from("traslados").select("id", { count: "exact", head: true }).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`).lt("actualizado_en", hace24h.toISOString()),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("modalidad_programacion", "programado")
      .gte("fecha_hora_programada", ahora.toISOString())
      .lte("fecha_hora_programada", en60Min.toISOString())
      .not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("estado", "pendiente_de_conductor"),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente_de_conductor")
      .lt("actualizado_en", hace24h.toISOString()),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("estado", "servicio_cerrado").gte("actualizado_en", hoy.toISOString()),
    cliente
      .from("traslados")
      .select("id", { count: "exact", head: true })
      .eq("estado", "servicio_cerrado")
      .gte("actualizado_en", ayerInicio.toISOString())
      .lt("actualizado_en", hoy.toISOString()),
    cliente.from("traslados").select("id", { count: "exact", head: true }).eq("tiene_incidencia_abierta", true).not("estado", "in", `(${ESTADOS_TERMINALES.join(",")})`),
    cliente
      .from("incidencias")
      .select("id", { count: "exact", head: true })
      .eq("resuelta", false)
      .gte("creada_en", hace48h.toISOString())
      .lt("creada_en", hace24h.toISOString()),
    listarExcepcionesCriticasAdmin(cliente)
  ]);

  for (const resultado of [activos, activosPrevios, inician60, sinAsignacion, sinAsignacionPrevio, cerradosHoy, cerradosAyer, conIncidencia, incidenciasPrevias]) {
    if (resultado.error) throw resultado.error;
  }

  const riesgoSla = excepciones.filter((item) => item.categoria === "sla_en_riesgo" || item.categoria === "sla_vencido").length;
  const riesgoSlaCritico = excepciones.filter((item) => item.categoria === "sla_vencido").length;
  const documentacionBloqueante = excepciones.filter((item) => item.categoria === "documentacion_bloqueante").length;
  const actualizadoEn = ahora.toISOString();

  return [
    {
      clave: "traslados_activos",
      titulo: "Traslados activos",
      valor: activos.count ?? 0,
      ventanaTemporal: "Ahora · operación abierta",
      variacion: porcentajeVariacion(activos.count ?? 0, activosPrevios.count ?? 0),
      umbral: "Atención > 12 · crítico > 18",
      subgrupoCritico: `${conIncidencia.count ?? 0} con incidencia`,
      href: "/viajes?filtro=activos",
      severidad: severidadIndicador(activos.count ?? 0, 18, 12),
      actualizadoEn
    },
    {
      clave: "inician_60_min",
      titulo: "Inician en 60 minutos",
      valor: inician60.count ?? 0,
      ventanaTemporal: "Próximos 60 min",
      variacion: 0,
      umbral: "Atención > 3 · crítico > 6",
      subgrupoCritico: `${sinAsignacion.count ?? 0} sin conductor`,
      href: "/viajes?filtro=inician_60",
      severidad: severidadIndicador(inician60.count ?? 0, 6, 3),
      actualizadoEn
    },
    {
      clave: "sin_asignacion",
      titulo: "Sin asignación",
      valor: sinAsignacion.count ?? 0,
      ventanaTemporal: "Ahora · pendientes de conductor",
      variacion: porcentajeVariacion(sinAsignacion.count ?? 0, sinAsignacionPrevio.count ?? 0),
      umbral: "Atención > 1 · crítico > 3",
      subgrupoCritico: `${Math.max(0, sinAsignacionPrevio.count ?? 0)} con más de 24 h`,
      href: "/viajes?filtro=sin_asignacion",
      severidad: severidadIndicador(sinAsignacion.count ?? 0, 3, 1),
      actualizadoEn
    },
    {
      clave: "riesgo_sla",
      titulo: "En riesgo de SLA",
      valor: riesgoSla,
      ventanaTemporal: "Ahora · excepciones SLA",
      variacion: 0,
      umbral: "Atención > 0 · crítico si vencido",
      subgrupoCritico: `${riesgoSlaCritico} vencidos`,
      href: "/alertas-sla?categoria=sla_en_riesgo",
      severidad: riesgoSlaCritico > 0 ? "critico" : riesgoSla > 0 ? "atencion" : "normal",
      actualizadoEn
    },
    {
      clave: "con_incidencia",
      titulo: "Con incidencia",
      valor: conIncidencia.count ?? 0,
      ventanaTemporal: "Ahora · traslados activos",
      variacion: porcentajeVariacion(conIncidencia.count ?? 0, incidenciasPrevias.count ?? 0),
      umbral: "Atención > 0 · crítico > 2",
      subgrupoCritico: `${documentacionBloqueante} documentación bloqueante`,
      href: "/viajes?filtro=incidencia",
      severidad: severidadIndicador(conIncidencia.count ?? 0, 2, 1),
      actualizadoEn
    },
    {
      clave: "finalizados_hoy",
      titulo: "Finalizados hoy",
      valor: cerradosHoy.count ?? 0,
      ventanaTemporal: "Hoy · 00:00 a ahora",
      variacion: porcentajeVariacion(cerradosHoy.count ?? 0, cerradosAyer.count ?? 0),
      umbral: "Meta >= cierre del día anterior",
      subgrupoCritico: `${cerradosAyer.count ?? 0} ayer`,
      href: "/viajes?filtro=finalizados_hoy",
      severidad: "normal",
      actualizadoEn
    }
  ];
}
