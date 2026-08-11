import type { Database } from "@ruum/shared/types";
import { obtenerConductorActual } from "@ruum/api/services";
import { crearClienteNavegador, tieneSupabaseConfigurado } from "../../lib/supabase-browser";

export type ConductorCuenta = Database["public"]["Tables"]["conductores"]["Row"] & {
  email?: string | null;
};

export async function cargarConductorCuenta(): Promise<ConductorCuenta | null> {
  if (!tieneSupabaseConfigurado()) return null;
  const cliente = crearClienteNavegador();
  const conductor = await obtenerConductorActual(cliente);
  if (!conductor) return null;
  const { data: sesion } = await cliente.auth.getUser();
  return {
    ...conductor,
    email: sesion.user?.email ?? null
  };
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
