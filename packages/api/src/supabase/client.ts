import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

// Cliente Supabase tipado contra el esquema real (ver
// packages/shared/src/types/supabase.ts, derivado de supabase/migrations).
// Las credenciales se inyectan vía variables de entorno (SUPABASE_URL /
// SUPABASE_ANON_KEY); este paquete no las hardcodea.
export function crearClienteSupabase(url: string, anonKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey);
}
