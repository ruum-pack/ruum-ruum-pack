import { type NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@ruum/api/supabase";

/**
 * Auditoría H-2 — Guard de autorización del panel-admin.
 *
 * Antes este middleware SOLO refrescaba el token de sesión (patrón estándar de
 * @supabase/ssr) y no bloqueaba nada: cualquier cuenta de Supabase Auth válida
 * —incluida la de un usuario final o un conductor, que viven en el MISMO
 * proyecto Auth— podía entrar a la Torre de Control. La única barrera eran las
 * policies `admin_acceso_total_*` (es_admin()); es decir, la autorización
 * dependía 100% de RLS. Esto añade la barrera que faltaba en la capa de la app:
 *
 *   1. Se conserva el refresh de sesión (getUser) — necesario para que no
 *      expire a media navegación.
 *   2. Rutas públicas (/login y assets de Next) pasan sin comprobación.
 *   3. En cualquier otra ruta: sin sesión -> /login; con sesión pero sin fila
 *      en `admins` -> /login?error=no_autorizado. Solo un admin real entra.
 *
 * Si Supabase no está configurado (modo demo), se conserva el comportamiento
 * anterior: no hay sesión que refrescar ni autorización que exigir.
 */

const RUTAS_PUBLICAS = ["/login"];

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Modo demo (sin Supabase): nada que refrescar ni que autorizar.
  if (!url || !anonKey) {
    return response;
  }

  const supabase = crearClienteServidor(url, anonKey, {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    }
  });

  // Refresca la sesión Y obtiene el usuario en una sola llamada (getUser valida
  // el token contra el servidor de Auth, a diferencia de getSession).
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Rutas públicas: no exigen sesión. Si un admin ya autenticado abre /login,
  // se le manda al dashboard para no mostrarle el formulario de nuevo.
  if (esRutaPublica(pathname)) {
    if (user) {
      const { data: adminSesion } = await supabase
        .from("admins")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (adminSesion) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return response;
  }

  // Ruta protegida sin sesión -> a login.
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Ruta protegida con sesión pero SIN fila en admins -> no autorizado.
  const { data: admin, error } = await supabase
    .from("admins")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !admin) {
    // Cerrar la sesión no-admin para no dejarla colgando en el panel.
    await supabase.auth.signOut();
    const destino = new URL("/login", request.url);
    destino.searchParams.set("error", "no_autorizado");
    return NextResponse.redirect(destino);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};