import type { Database } from "@ruum/shared/types";

/**
 * FASE 6 — Infraestructura compartida: clasificación de errores Supabase para
 * fallbacks de paginación. Movido sin cambios desde services/admin.ts (lo
 * usaban viajes, conductores y empresas); un solo hogar para no duplicar.
 */
type PasaporteRow = Database["public"]["Views"]["pasaporte_digital"]["Row"];

export function esRpcNoEncontrado(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const datos = error as { code?: string; message?: string; details?: string; status?: number };
  const texto = `${datos.code ?? ""} ${datos.message ?? ""} ${datos.details ?? ""}`.toLowerCase();
  return datos.status === 404 || texto.includes("pgrst202") || texto.includes("could not find the function") || texto.includes("not found");
}

export function esRpcPaginacionNoDisponible(error: unknown): boolean {
  if (esRpcNoEncontrado(error) || esRecursoSupabasePendiente(error)) return true;
  if (!error || typeof error !== "object") return false;
  const datos = error as { code?: string; message?: string; details?: string; status?: number };
  const texto = `${datos.code ?? ""} ${datos.message ?? ""} ${datos.details ?? ""}`.toLowerCase();
  return (
    datos.status === 400 &&
    !texto.includes("42501") &&
    !texto.includes("permiso") &&
    !texto.includes("permission")
  );
}

export function esRecursoSupabasePendiente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const datos = error as { code?: string; message?: string; details?: string; status?: number };
  const texto = `${datos.code ?? ""} ${datos.message ?? ""} ${datos.details ?? ""}`.toLowerCase();
  return (
    datos.status === 404 ||
    datos.code === "42P01" ||
    datos.code === "42703" ||
    texto.includes("pgrst202") ||
    texto.includes("pgrst204") ||
    texto.includes("could not find") ||
    texto.includes("does not exist") ||
    texto.includes("not found")
  );
}

export function columnaOrdenPasaporte(columna?: string): keyof PasaporteRow {
  switch (columna) {
    case "folio":
      return "traslado_id";
    case "inicio_programado":
      return "creado_en";
    case "ruta":
      return "origen_ciudad";
    case "vehiculo":
      return "vehiculo_marca";
    case "conductor":
      return "conductor_nombre";
    case "estatus":
      return "estado";
    default:
      return "creado_en";
  }
}
