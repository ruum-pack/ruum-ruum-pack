import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

/**
 * Cliente Supabase para Server Components, Route Handlers y middleware.
 * No importa `next/headers` aquí a propósito: este paquete no depende de
 * Next.js en ningún otro lado, así que el wiring de cookies reales
 * (`cookies()` de next/headers, o el request/response del middleware) vive
 * en cada app, en su propio `lib/supabase-server.ts` / `middleware.ts` —
 * esta función solo necesita un objeto con la forma que pide @supabase/ssr.
 *
 * Mismo cast deliberado que browser-client.ts (ver su comentario): el tipo
 * genérico no coincide exactamente entre librerías por versión, el objeto
 * en runtime sí es idéntico.
 */
export function crearClienteServidor(url: string, anonKey: string, cookies: CookieMethodsServer): SupabaseClient<Database> {
  return createServerClient<Database>(url, anonKey, { cookies }) as unknown as SupabaseClient<Database>;
}
