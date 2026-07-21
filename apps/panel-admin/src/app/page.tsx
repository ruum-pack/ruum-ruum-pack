import DashboardCliente, { type DashboardInitialData } from "./DashboardCliente";
import { crearClienteServidor } from "../lib/supabase-server";
import { listarConductoresAdmin, listarIncidenciasAdmin, obtenerAdminActual, obtenerAlertasEmergenciaAdmin, obtenerIndicadoresAccionablesDashboard } from "@ruum/api/services";
import { normalizarRolAdmin } from "../lib/roles-admin";

export const dynamic = "force-dynamic";

async function cargarInicial(): Promise<DashboardInitialData | null> {
  try {
    const cliente = await crearClienteServidor();
    const [admin, indicadores, incidencias, conductores, emergencias] = await Promise.all([
      obtenerAdminActual(cliente), obtenerIndicadoresAccionablesDashboard(cliente), listarIncidenciasAdmin(cliente),
      listarConductoresAdmin(cliente), obtenerAlertasEmergenciaAdmin(cliente)
    ]);
    return {
      indicadores,
      incidencias: incidencias.filter((item) => !item.resuelta),
      conductoresDocVencido: conductores.filter((item) => !item.documentos_vigentes),
      emergencias,
      rol: normalizarRolAdmin(admin?.rol_operativo),
      cargadoEn: new Date().toISOString()
    };
  } catch (error) {
    console.error("[dashboard] lectura inicial de servidor fallida", error);
    return null;
  }
}

export default async function PaginaDashboard() {
  return <DashboardCliente inicial={await cargarInicial()} />;
}
