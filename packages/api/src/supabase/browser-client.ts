import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ruum/shared/types";

/**
 * Cliente Supabase para componentes de cliente ("use client"), con sesión
 * persistida en cookies (no localStorage) — necesario para que el servidor
 * (middleware, Server Components) también pueda leer la sesión. Reemplaza
 * el uso directo de `createClient` de @supabase/supabase-js que tenían las
 * apps hasta ahora: ese cliente nunca persistía sesión entre recargas.
 *
 * El "as unknown as" es deliberado, no un escape de pereza: @supabase/ssr
 * y @supabase/supabase-js resuelven el tipo genérico SupabaseClient<Database>
 * de forma distinta entre sí (versiones con distinta cantidad de parámetros
 * genéricos), aunque en runtime el objeto que devuelven es idéntico en forma
 * y comportamiento. Sin este cast, cada función de packages/api/src/services
 * tendría que pelear con ese desajuste por separado.
 */
export function crearClienteNavegador(url: string, anonKey: string): SupabaseClient<Database> {
  return createBrowserClient<Database>(url, anonKey) as unknown as SupabaseClient<Database>;
}
