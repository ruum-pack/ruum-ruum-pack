import { crearClienteNavegador as crearCliente } from "@ruum/api/supabase";

export function tieneSupabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Cliente Supabase para el navegador, con sesión persistida en cookies
 * (no localStorage) vía @supabase/ssr — necesario para que el middleware y
 * los Server Components también puedan leer la sesión real. Lanza un error
 * claro si las variables de entorno no están configuradas; las pantallas
 * deben revisar `tieneSupabaseConfigurado()` antes de usarlo.
 */
export function crearClienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  return crearCliente(url, anonKey);
}
