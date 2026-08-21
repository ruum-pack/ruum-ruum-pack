import { type NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@ruum/api/supabase";

const RUTAS_PUBLICAS_CONDUCTOR = [
  "/login",
  "/registro",
  "/onboarding",
  "/recuperar-password",
  "/nueva-password",
  "/legal",
  "/auth",
  "/actualizacion-requerida"
];

function esRutaPublicaConductor(pathname: string): boolean {
  return RUTAS_PUBLICAS_CONDUCTOR.some((ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`));
}

/**
 * P0.1 — Seguridad + sesión (producción)
 * 1. Fail-closed en producción si Supabase no está configurado.
 * 2. Refresca el token en cada petición (getUser valida contra Auth).
 * 3. Gate de autenticación: rutas protegidas sin sesión → /login?next=...
 * 4. Redirección inversa: sesión válida en /login|/registro → /panel.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const esProduccion = process.env.NODE_ENV === "production";

  if (esProduccion && (!url || !anonKey)) {
    console.error("[security] app-conductor bloqueado: Supabase no configurado en producción", {
      pathname: request.nextUrl.pathname
    });
    return new NextResponse("Configuración de producción incompleta", { status: 503 });
  }

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

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPublica = esRutaPublicaConductor(pathname);
  const esRutaAuth = pathname === "/login" || pathname === "/registro" || pathname === "/onboarding";

  if (!user && !esPublica) {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("next", pathname);
    return NextResponse.redirect(destino);
  }

  if (user && esRutaAuth) {
    // Usuario ya autenticado no debe ver login/registro/onboarding
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
