import type { Database } from "@ruum/shared/types";
import { obtenerConductorActual } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export type ConductorCuenta = Database["public"]["Tables"]["conductores"]["Row"];

export async function cargarConductorCuenta(): Promise<ConductorCuenta | null> {
  if (!tieneSupabaseConfigurado()) return null;
  const cliente = crearClienteNavegador();
  return obtenerConductorActual(cliente);
}

export function fechaCuenta(fechaIso: string | null | undefined) {
  if (!fechaIso) return "Pendiente";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(fechaIso));
}

export function telefonoE164(valor: string) {
  const soloDigitos = valor.replace(/\D/g, "").trim();
  if (!soloDigitos) return "";

  if (soloDigitos.length === 10) return `+52${soloDigitos}`;
  if (soloDigitos.length === 12 && soloDigitos.startsWith("52")) return `+${soloDigitos}`;
  if (soloDigitos.length > 10 && soloDigitos.startsWith("521")) return `+${soloDigitos}`;

  return `+${soloDigitos}`;
}
