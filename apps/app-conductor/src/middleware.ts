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
  "/actualizacion-requerida",
  "/api"
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
function buildCsp(nonce: string, isProd: boolean, isStaging: boolean) {
  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://*.sentry.io`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io`;
  // SEC-003: flag para eliminar unsafe-inline de style-src en prod (objetivo 2026-11-01)
  // Cuando CSP_STRICT_STYLES=true, style-src queda solo con nonce (sin unsafe-inline)
  // Validar 1 semana en staging report-only antes de activar en prod.
  const strictStyles = process.env.CSP_STRICT_STYLES === "true" || process.env.NEXT_PUBLIC_CSP_STRICT_STYLES === "true";
  const styleSrc = strictStyles && isProd
    ? `style-src 'self' 'nonce-${nonce}'`
    : `style-src 'self' 'unsafe-inline' 'nonce-${nonce}'`;
  const base = [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    "connect-src 'self' https://*.supabase.co https://*.mapbox.com https://*.sentry.io https://*.didit.me https://verify.didit.me" + (isProd ? "" : " ws: wss: http://localhost:* http://127.0.0.1:*"),
    "img-src 'self' data: blob: https://*.supabase.co https://*.mapbox.com https://*.didit.me https://verify.didit.me",
    "font-src 'self' data:",
    "frame-src 'self' https://verify.didit.me https://*.didit.me",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:"
  ].join("; ");
  return base;
}

function applyCspHeaders(res: NextResponse, nonce: string) {
  const isProd = process.env.NODE_ENV === "production";
  const isStaging = process.env.NEXT_PUBLIC_RUUM_AMBIENTE === "staging";
  const csp = buildCsp(nonce, isProd, isStaging);
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("x-nonce", nonce);
  if (isStaging) {
    res.headers.set("Content-Security-Policy-Report-Only", csp + "; report-uri /api/csp-report; report-to csp-endpoint");
  }
  return res;
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-nonce", nonce);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const esProduccion = process.env.NODE_ENV === "production";

  if (esProduccion && (!url || !anonKey)) {
    console.error("[security] app-conductor bloqueado: Supabase no configurado en producción", {
      pathname: request.nextUrl.pathname
    });
    return applyCspHeaders(new NextResponse("Configuración de producción incompleta", { status: 503 }), nonce);
  }

  if (!url || !anonKey) {
    return applyCspHeaders(response, nonce);
  }

  const supabase = crearClienteServidor(url, anonKey, {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      response.headers.set("x-nonce", nonce);
      cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPublica = esRutaPublicaConductor(pathname);
  const esRutaAuth = pathname === "/login" || pathname === "/onboarding";

  if (!user && !esPublica) {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("next", pathname);
    return applyCspHeaders(NextResponse.redirect(destino), nonce);
  }

  if (user && esRutaAuth) {
    // Usuario ya autenticado no debe ver login/onboarding.
    // /registro se excluye a propósito: un conductor autenticado puede seguir
    // ahí a mitad de registro (borrador/correo_pendiente/datos_incompletos/
    // documentos_pendientes) tras confirmar su correo — ver auth/callback/route.ts
    // (destinoComoConductor) y registro/page.tsx (sesionAutenticada). Forzar la
    // redirección a /panel aquí producía un loop infinito /registro ↔ /panel,
    // porque usePanelData.ts redirige de vuelta a /registro para esos mismos
    // estados. La propia página de registro ya redirige a /panel cuando detecta
    // un conductor aprobado o una solicitud lista para enviar.
    return applyCspHeaders(NextResponse.redirect(new URL("/panel", request.url)), nonce);
  }

  return applyCspHeaders(response, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
