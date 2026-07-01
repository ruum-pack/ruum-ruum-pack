import { cookies } from "next/headers";
import { crearClienteServidor as crearCliente } from "@ruum/api/supabase";

/**
 * Cliente Supabase para Server Components y Route Handlers, leyendo la
 * sesión real desde las cookies de la petición (puestas ahí por el
 * middleware). `setAll` puede fallar dentro de un Server Component puro
 * (no se pueden escribir cookies fuera de un Route Handler o Server Action)
 * — se ignora ese error a propósito: el middleware ya se encarga de
 * refrescar la sesión en cada petición.
 */
export async function crearClienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  const cookieStore = await cookies();

  return crearCliente(url, anonKey, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      } catch {
        // Llamado desde un Server Component (no un Route Handler/Server Action): no se puede escribir.
      }
    }
  });
}
