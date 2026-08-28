import { type NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@ruum/api/supabase";

/**
 * Refresca el token de sesión en cada petición — sin esto, una sesión larga
 * termina expirando a la mitad de la navegación aunque el usuario siga
 * activo. Patrón estándar de @supabase/ssr para Next.js App Router.
 * Si Supabase no está configurado, no hay nada que refrescar.
 */
const RUTAS_PROTEGIDAS_USUARIO = [
  "/traslados",
  "/mis-viajes",
  "/cuenta",
  "/pasaporte",
  "/verificacion"
];

function esRutaProtegidaUsuario(pathname: string): boolean {
  return RUTAS_PROTEGIDAS_USUARIO.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && esRutaProtegidaUsuario(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", pathname);
    login.searchParams.set("reason", "authentication_required");
    return NextResponse.redirect(login);
  }

  if (user && (pathname === "/login" || pathname === "/registro")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
