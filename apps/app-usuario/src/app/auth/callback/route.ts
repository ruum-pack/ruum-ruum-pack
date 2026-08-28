/**
 * /auth/callback — Intercepta los deep links de Supabase Auth en app-usuario.
 *
 * Supabase redirige aquí tras confirmar email (signup), recuperar contraseña
 * (recovery) o usar magic link. Intercambia el code/token_hash por sesión y
 * redirige al destino correcto. Si el cliente recibe fragmentos hash (#access_token=...),
 * el fallback HTML/JS procesa la sesión en el navegador y enruta a /nueva-password o /onboarding.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@ruum/api/supabase";

type TipoOtpSanitizado = "signup" | "recovery" | "magiclink" | "email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash =
    searchParams.get("token_hash") ||
    searchParams.get("token") ||
    searchParams.get("confirmation_token");
  const rawType = (searchParams.get("type") || searchParams.get("event") || "").toLowerCase();
  const nextParam = (searchParams.get("next") || searchParams.get("redirectTo") || "").toLowerCase();

  // Mapear tipos de Supabase a los valores reconocidos por verifyOtp/recovery
  let type: TipoOtpSanitizado = "signup";
  if (rawType === "recovery" || nextParam.includes("nueva-password")) {
    type = "recovery";
  } else if (rawType === "magiclink") {
    type = "magiclink";
  } else if (rawType === "email" || rawType === "email_change") {
    type = "email";
  } else {
    type = "signup";
  }

  const nextSolicitado = searchParams.get("next") ?? (type === "recovery" ? "/nueva-password" : "/onboarding?nuevo=1");
  const next = nextSolicitado.startsWith("/") && !nextSolicitado.startsWith("//") ? nextSolicitado : "/";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const destinoErrorServer =
    type === "recovery"
      ? "/recuperar-password?error=enlace_invalido"
      : "/login?reason=email_confirmation&error=enlace_invalido";

  // Si no hay configuración de Supabase, redirigir al fallback de error
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}${destinoErrorServer}`);
  }

  const cookieStore = await cookies();
  const supabase = crearClienteServidor(url, anonKey, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      } catch {
        /* Route Handler puede escribir cookies */
      }
    },
  });

  // 1. Flujo PKCE (autorización por código)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destino = type === "recovery" ? "/nueva-password" : next;
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  // 2. Flujo OTP / Hash (verificación de token por correo)
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      const destino = type === "recovery" ? "/nueva-password" : next;
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  // 3. Respuesta HTML/JS ligera para capturar fragmentos de hash en el navegador (#access_token=... o fallback)
  const htmlFallback = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Verificando cuenta...</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #070d18; color: #f8faf5; }
        .card { text-align: center; padding: 2rem; border-radius: 1rem; background: #0d1526; border: 1px solid #1c2a3e; max-width: 400px; }
      </style>
    </head>
    <body>
      <div class="card">
        <p>Verificando tu enlace de seguridad...</p>
      </div>
      <script src="/auth-callback-fallback.js"></script>
    </body>
    </html>
  `;

  return new NextResponse(htmlFallback, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
