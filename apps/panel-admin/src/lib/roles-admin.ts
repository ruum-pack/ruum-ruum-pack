import type { ClaveIndicadorDashboard } from "@ruum/api/services";
import type { Database } from "@ruum/shared/types";

export type RolAdminOperativo = Database["public"]["Enums"]["rol_admin_operativo"];

export type WidgetDashboardAdmin =
  | "emergencias"
  | "indicadores"
  | "alertas_operativas"
  | "acciones_frecuentes";

type ConfiguracionRolAdmin = {
  etiqueta: string;
  descripcion: string;
  widgets: WidgetDashboardAdmin[];
  indicadores: ClaveIndicadorDashboard[];
  rutasPermitidas: string[];
};

export const ROL_ADMIN_DEFAULT: RolAdminOperativo = "operador";

export const CONFIG_ROL_ADMIN: Record<RolAdminOperativo, ConfiguracionRolAdmin> = {
  operador: {
    etiqueta: "Operador",
    descripcion: "Prioriza ejecución diaria, asignación y atención inmediata.",
    widgets: ["emergencias", "alertas_operativas", "indicadores", "acciones_frecuentes"],
    indicadores: ["sin_asignacion", "inician_60_min", "traslados_activos", "con_incidencia"],
    rutasPermitidas: ["/", "/viajes", "/masivos", "/mapa", "/alertas-sla", "/conductores", "/incidencias"]
  },
  supervisor: {
    etiqueta: "Supervisor",
    descripcion: "Prioriza excepciones, escalamiento y control de calidad operativo.",
    widgets: ["emergencias", "alertas_operativas", "indicadores", "acciones_frecuentes"],
    indicadores: ["riesgo_sla", "sin_asignacion", "con_incidencia", "traslados_activos", "finalizados_hoy"],
    rutasPermitidas: ["/", "/viajes", "/masivos", "/mapa", "/alertas-sla", "/conductores", "/metricas-registro", "/incidencias", "/disputas", "/documentos", "/reportes"]
  },
  finanzas: {
    etiqueta: "Finanzas",
    descripcion: "Prioriza cierres, pagos y política tarifaria.",
    widgets: ["indicadores", "alertas_operativas"],
    indicadores: ["finalizados_hoy", "traslados_activos", "con_incidencia", "riesgo_sla"],
    rutasPermitidas: ["/", "/viajes", "/pagos", "/tarifas", "/reportes", "/disputas", "/reclamos-seguro"]
  },
  compliance: {
    etiqueta: "Compliance",
    descripcion: "Prioriza documentación, incidencias, SLA y evidencia auditables.",
    widgets: ["emergencias", "alertas_operativas", "indicadores"],
    indicadores: ["riesgo_sla", "con_incidencia", "sin_asignacion", "traslados_activos"],
    rutasPermitidas: ["/", "/alertas-sla", "/documentos", "/incidencias", "/usuarios", "/conductores", "/empresas", "/reclamos-seguro", "/reportes"]
  },
  direccion: {
    etiqueta: "Dirección",
    descripcion: "Prioriza salud general, riesgos y resultados del día.",
    widgets: ["indicadores", "emergencias", "alertas_operativas"],
    indicadores: ["traslados_activos", "finalizados_hoy", "riesgo_sla", "con_incidencia", "sin_asignacion"],
    rutasPermitidas: ["/", "/viajes", "/mapa", "/alertas-sla", "/reportes", "/pagos", "/tarifas", "/incidencias", "/disputas", "/reclamos-seguro"]
  }
};

export function normalizarRolAdmin(valor: unknown): RolAdminOperativo {
  return valor === "supervisor" ||
    valor === "finanzas" ||
    valor === "compliance" ||
    valor === "direccion" ||
    valor === "operador"
    ? valor
    : ROL_ADMIN_DEFAULT;
}

export function rutaBaseAdmin(href: string) {
  return href.split("?")[0] ?? href;
}

export function puedeVerRuta(rol: RolAdminOperativo, href: string) {
  return CONFIG_ROL_ADMIN[rol].rutasPermitidas.includes(rutaBaseAdmin(href));
}
