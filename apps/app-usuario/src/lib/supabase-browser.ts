import { createClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

export function tieneSupabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Cliente Supabase para el navegador. Lanza un error claro si las
 * variables de entorno no están configuradas en vez de fallar de forma
 * confusa dentro de una llamada de red — las pantallas deben revisar
 * `tieneSupabaseConfigurado()` antes de usarlo y mostrar un estado de
 * "modo demo" en su lugar.
 */
export function crearClienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  return createClient<Database>(url, anonKey);
}
