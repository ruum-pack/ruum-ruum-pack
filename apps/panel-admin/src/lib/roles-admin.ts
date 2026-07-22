import type { ClaveIndicadorDashboard, PermisoAdmin } from "@ruum/api/services";
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
    rutasPermitidas: ["/", "/viajes", "/masivos", "/mapa", "/alertas-sla", "/conductores", "/metricas-registro", "/incidencias", "/disputas", "/documentos", "/reportes", "/auditoria", "/aprobaciones", "/configuracion"]
  },
  finanzas: {
    etiqueta: "Finanzas",
    descripcion: "Prioriza cierres, pagos y política tarifaria.",
    widgets: ["indicadores", "alertas_operativas"],
    indicadores: ["finalizados_hoy", "traslados_activos", "con_incidencia", "riesgo_sla"],
    rutasPermitidas: ["/", "/viajes", "/pagos", "/tarifas", "/reportes", "/disputas", "/reclamos-seguro", "/configuracion"]
  },
  compliance: {
    etiqueta: "Compliance",
    descripcion: "Prioriza documentación, incidencias, SLA y evidencia auditables.",
    widgets: ["emergencias", "alertas_operativas", "indicadores"],
    indicadores: ["riesgo_sla", "con_incidencia", "sin_asignacion", "traslados_activos"],
    rutasPermitidas: ["/", "/alertas-sla", "/documentos", "/incidencias", "/usuarios", "/conductores", "/empresas", "/reclamos-seguro", "/reportes", "/auditoria", "/aprobaciones", "/configuracion"]
  },
  direccion: {
    etiqueta: "Dirección",
    descripcion: "Acceso integral a la operación, los riesgos y los resultados del día.",
    widgets: ["emergencias", "indicadores", "alertas_operativas", "acciones_frecuentes"],
    indicadores: ["traslados_activos", "inician_60_min", "sin_asignacion", "riesgo_sla", "con_incidencia", "finalizados_hoy"],
    rutasPermitidas: ["/", "/viajes", "/mapa", "/alertas-sla", "/reportes", "/pagos", "/tarifas", "/incidencias", "/disputas", "/reclamos-seguro", "/auditoria", "/aprobaciones", "/masivos", "/conductores", "/usuarios", "/vehiculos", "/empresas", "/documentos", "/configuracion", "/capacidades", "/metricas-registro"]
  }
};

// Mapa ruta → capacidad requerida (middleware capability check)
// Las rutas se evalúan de más específica a menos específica.
export const RUTA_A_CAPACIDAD: Record<string, PermisoAdmin> = {
  "/auditoria": "auditoria:leer",
  "/aprobaciones": "aprobaciones:aprobar",
  "/capacidades": "capacidades:administrar",
  "/configuracion": "configuracion:leer",
  "/conductores": "conductores:leer",
  "/disputas": "disputas:leer",
  "/documentos": "conductores:validar",
  "/empresas": "empresas:leer",
  "/incidencias": "incidencias:leer",
  "/masivos": "masivos:gestionar",
  "/metricas-registro": "conductores:leer",
  "/pagos": "pagos:leer",
  "/reclamos-seguro": "reclamos_seguro:leer",
  "/reportes": "exportaciones:crear",
  "/tarifas": "tarifas:leer",
  "/usuarios": "usuarios:leer",
  "/vehiculos": "conductores:leer",
  "/viajes": "viajes:leer",
  "/mapa": "viajes:leer",
  "/alertas-sla": "viajes:leer",
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
  const ruta = rutaBaseAdmin(href);
  if (ruta === "/sin-permiso" || rol === "direccion") return true;
  return CONFIG_ROL_ADMIN[rol].rutasPermitidas.some(
    (permitida) => permitida === "/" ? ruta === "/" : ruta === permitida || ruta.startsWith(`${permitida}/`)
  );
}

export function obtenerCapacidadParaRuta(href: string): PermisoAdmin | null {
  const ruta = rutaBaseAdmin(href);
  if (ruta === "/" || ruta === "/sin-permiso") return null;
  const ordenada = Object.keys(RUTA_A_CAPACIDAD).sort((a, b) => b.split("/").length - a.split("/").length);
  for (const prefijo of ordenada) {
    if (ruta === prefijo || ruta.startsWith(`${prefijo}/`)) return RUTA_A_CAPACIDAD[prefijo];
  }
  return null;
}
