import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { crearClienteServidor } from "@ruum/api/supabase";
import { obtenerConductorActual, obtenerSolicitudConductorActual } from "@ruum/api/services";

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
    type = "signup"; // Cubre "signup", "email_confirmation" y valores por defecto de registro
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  const destinoErrorServer =
    type === "recovery"
      ? "/recuperar-password?error=enlace_invalido"
      : "/registro?error=enlace_invalido";

  // Si no hay configuración de Supabase, redirigir al fallback de error correspondiente al flujo
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

  async function destinoComoConductor() {
    if (type === "recovery") return "/nueva-password";
    try {
      const solicitud = await obtenerSolicitudConductorActual(supabase);
      if (solicitud) {
        return ["listo_para_enviar", "en_revision", "requiere_correccion", "aprobado", "rechazado", "suspendido"].includes(solicitud.estado)
          ? "/panel"
          : "/registro?verificado=1";
      }
      return (await obtenerConductorActual(supabase)) ? "/panel" : "/registro?verificado=1";
    } catch {
      return "/registro?verificado=1";
    }
  }

  // 1. Flujo PKCE (autorización por código)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destino = await destinoComoConductor();
      return NextResponse.redirect(`${origin}${destino}`);
    }
    // Si la verificación por código falló en el servidor (ej: token usado o expirado), redirigir directamente al error del flujo
    return NextResponse.redirect(`${origin}${destinoErrorServer}`);
  }

  // 2. Flujo OTP / Hash (verificación de token por correo)
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      const destino = await destinoComoConductor();
      return NextResponse.redirect(`${origin}${destino}`);
    }
    // Si la verificación OTP falló en el servidor, redirigir al error del flujo
    return NextResponse.redirect(`${origin}${destinoErrorServer}`);
  }

  // 3. Respuesta HTML/JS ligera para capturar fragmentos de hash en el navegador (#access_token=...)
  // P2 CSP: script externo sin interpolación para permitir hash/nonce y evitar 'unsafe-inline'
  const htmlFallback = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Verificando cuenta...</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
        .card { text-align: center; padding: 2rem; border-radius: 1rem; background: #1e293b; max-width: 400px; }
      </style>
    </head>
    <body>
      <div class="card">
        <p>Verificando tu enlace...</p>
      </div>
      <script src="/auth-callback-fallback.js"></script>
    </body>
    </html>
  `;

  return new NextResponse(htmlFallback, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
